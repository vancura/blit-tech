/**
 * Utilities for capturing a rendered WebGPU frame as a PNG blob.
 *
 * The module handles row alignment, optional BGRA swizzling, GPU readback, and
 * browser-side PNG encoding.
 */

// #region Constants

/**
 * Represents the required byte alignment for the number of bytes per row
 * in a data buffer. This value ensures that each row of data starts at a
 * memory address divisible by the specified alignment.
 *
 * Alignment is crucial for optimizing memory access and ensuring compatibility
 * with hardware requirements, such as in graphics or compute operations.
 *
 * The value is typically a power of 2, which simplifies calculations and
 * aligns with common hardware constraints.
 */
const BYTES_PER_ROW_ALIGNMENT = 256;

/**
 * Represents the number of bytes used to store a single pixel in an image or graphics context.
 * This constant is typically used in image processing or graphics-related computations to
 * determine memory requirements or to process pixel data.
 *
 * The value of 4 signifies that each pixel is represented using 4 bytes, which is commonly
 * associated with RGBA color models, where each component (Red, Green, Blue, and Alpha)
 * occupies one byte.
 */
const BYTES_PER_PIXEL = 4;

// #endregion

// #region Pending Capture State

/**
 * Represents a function type that processes a `Blob` object.
 *
 * This type is commonly used for asynchronous operations where a `Blob`
 * result needs to be captured or processed, such as handling media streams
 * or creating output from captured data.
 *
 * @callback CaptureResolve
 * @param {Blob} blob - The `Blob` object to be processed.
 */
type CaptureResolve = (blob: Blob) => void;

/**
 * A type alias representing a function used to handle rejection scenarios during an operation.
 *
 * This function is typically invoked to signal that an operation has failed.
 * The function accepts an Error object as a parameter, which provides details
 * regarding the reason for the failure.
 *
 * @callback CaptureReject
 * @param {Error} reason - The error object representing the reason for the rejection.
 */
type CaptureReject = (reason: Error) => void;

// #endregion

// #region Helper Functions

/**
 * Calculates the aligned byte size per row for a given image width.
 *
 * The alignment ensures that the byte size per row is compliant with the specified row alignment boundary.
 *
 * @param {number} width - The width of the image in pixels.
 * @returns {number} The aligned byte size per row.
 */
export function alignedBytesPerRow(width: number): number {
    const unaligned = width * BYTES_PER_PIXEL;

    return Math.ceil(unaligned / BYTES_PER_ROW_ALIGNMENT) * BYTES_PER_ROW_ALIGNMENT;
}

/**
 * Converts a pixel array from BGRA format to RGBA format by swapping the blue and red color channels.
 *
 * @param {Uint8ClampedArray} data - The pixel array in BGRA format. Each pixel is represented by 4 consecutive bytes (blue, green, red, alpha).
 * @returns {void} This function modifies the input array in place and does not return a value.
 */
export function swizzleBGRAtoRGBA(data: Uint8ClampedArray): void {
    for (let i = 0; i < data.length; i += BYTES_PER_PIXEL) {
        // eslint-disable-next-line security/detect-object-injection -- typed array indexed by loop counter
        const b = data[i] ?? 0;
        const r = data[i + 2] ?? 0;

        // eslint-disable-next-line security/detect-object-injection -- typed array indexed by loop counter
        data[i] = r;
        data[i + 2] = b;
    }
}

/**
 * Converts a pixel buffer into a PNG image Blob.
 *
 * @param {ArrayBuffer} buffer - The input pixel buffer containing the raw image data.
 * @param {number} width - The width of the image in pixels.
 * @param {number} height - The height of the image in pixels.
 * @param {number} paddedBytesPerRow - The number of bytes per row in the buffer, including padding bytes.
 * @param {boolean} isBGRA - Indicates whether the pixel data is in BGRA format and needs to be converted to RGBA.
 * @returns {Promise<Blob>} A promise that resolves to a Blob containing the PNG image.
 */
export async function pixelBufferToPNG(
    buffer: ArrayBuffer,
    width: number,
    height: number,
    paddedBytesPerRow: number,
    isBGRA: boolean,
): Promise<Blob> {
    const actualBytesPerRow = width * BYTES_PER_PIXEL;
    const pixels = new Uint8ClampedArray(width * height * BYTES_PER_PIXEL);
    const source = new Uint8Array(buffer);

    // Copy rows, stripping any padding bytes.
    for (let y = 0; y < height; y++) {
        const srcOffset = y * paddedBytesPerRow;
        const dstOffset = y * actualBytesPerRow;

        pixels.set(source.subarray(srcOffset, srcOffset + actualBytesPerRow), dstOffset);
    }

    if (isBGRA) {
        swizzleBGRAtoRGBA(pixels);
    }

    const imageData = new ImageData(pixels, width, height);
    const offscreen = new OffscreenCanvas(width, height);
    const ctx = offscreen.getContext('2d');

    if (!ctx) {
        throw new Error('[FrameCapture] Failed to create 2D context on OffscreenCanvas');
    }

    ctx.putImageData(imageData, 0, 0);

    return await offscreen.convertToBlob({ type: 'image/png' });
}

// #endregion

// #region FrameCapture Class

/**
 * Class responsible for capturing a single frame from a WebGPU rendering pipeline and converting it to a PNG Blob.
 */
export class FrameCapture {
    /** Resolve callback for the pending capture. */
    private pendingResolve: CaptureResolve | null = null;

    /** Reject callback for the pending capture. */
    private pendingReject: CaptureReject | null = null;

    /** Staging buffer for GPU-to-CPU readback. */
    private stagingBuffer: GPUBuffer | null = null;

    /** Width of the captured frame. */
    private captureWidth = 0;

    /** Height of the captured frame. */
    private captureHeight = 0;

    /** Padded bytes per row used in the staging buffer. */
    private paddedBytesPerRow = 0;

    /** Whether the source format is BGRA. */
    private isBGRA = false;

    /**
     * Returns true if a capture is queued and waiting for the next frame.
     *
     * @returns True if a capture request is pending.
     */
    hasPendingCapture(): boolean {
        return this.pendingResolve !== null;
    }

    /**
     * Queues capture of the next submitted frame.
     * If another request is already pending, that earlier request is rejected.
     *
     * @returns Promise resolving to the captured PNG Blob.
     */
    requestCapture(): Promise<Blob> {
        if (this.pendingResolve) {
            this.pendingReject?.(new Error('[FrameCapture] Capture superseded by a new request'));

            this.cleanup();
        }

        return new Promise<Blob>((resolve, reject) => {
            this.pendingResolve = resolve;
            this.pendingReject = reject;
        });
    }

    /**
     * Records the texture-to-buffer copy needed for a pending frame capture.
     * Call after the render pass ends but before submitting the command buffer.
     *
     * @param device - WebGPU device for buffer creation.
     * @param texture - The rendered canvas texture to capture.
     * @param commandEncoder - Active command encoder to add the copy command to.
     */
    executeCaptureInEncoder(device: GPUDevice, texture: GPUTexture, commandEncoder: GPUCommandEncoder): void {
        this.captureWidth = texture.width;
        this.captureHeight = texture.height;
        this.paddedBytesPerRow = alignedBytesPerRow(this.captureWidth);
        this.isBGRA = texture.format === 'bgra8unorm';

        const bufferSize = this.paddedBytesPerRow * this.captureHeight;

        this.stagingBuffer = device.createBuffer({
            label: 'Frame Capture Staging',
            size: bufferSize,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });

        commandEncoder.copyTextureToBuffer(
            { texture },
            { buffer: this.stagingBuffer, bytesPerRow: this.paddedBytesPerRow, rowsPerImage: this.captureHeight },
            { width: this.captureWidth, height: this.captureHeight },
        );
    }

    /**
     * Waits for GPU completion, reads back the staging buffer, and resolves the pending capture.
     *
     * @param device - WebGPU device (used for onSubmittedWorkDone).
     */
    async resolveCapture(device: GPUDevice): Promise<void> {
        const resolve = this.pendingResolve;
        const reject = this.pendingReject;
        const buffer = this.stagingBuffer;

        // Clear pending state immediately so the next frame is not affected.
        this.pendingResolve = null;
        this.pendingReject = null;
        this.stagingBuffer = null;

        if (!resolve || !reject || !buffer) {
            return;
        }

        try {
            await device.queue.onSubmittedWorkDone();
            await buffer.mapAsync(GPUMapMode.READ);

            const data = buffer.getMappedRange();
            const blob = await pixelBufferToPNG(
                data,
                this.captureWidth,
                this.captureHeight,
                this.paddedBytesPerRow,
                this.isBGRA,
            );

            buffer.unmap();
            buffer.destroy();
            resolve(blob);
        } catch (error) {
            buffer.destroy();
            reject(error instanceof Error ? error : new Error(String(error)));
        }
    }

    /** Clears the pending capture state and destroys any staging buffer. */
    private cleanup(): void {
        this.pendingResolve = null;
        this.pendingReject = null;

        if (this.stagingBuffer) {
            this.stagingBuffer.destroy();
            this.stagingBuffer = null;
        }
    }
}

// #endregion
