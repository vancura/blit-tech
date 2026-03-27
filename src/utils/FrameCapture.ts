/**
 * Utilities for capturing a rendered WebGPU frame as a PNG blob.
 *
 * The module handles row alignment, optional BGRA swizzling, GPU readback, and
 * browser-side PNG encoding.
 */

// #region Constants

/** WebGPU requires buffer row byte alignment to be a multiple of this value. */
const BYTES_PER_ROW_ALIGNMENT = 256;

/** Bytes per pixel for RGBA/BGRA 8-bit formats. */
const BYTES_PER_PIXEL = 4;

// #endregion

// #region Pending Capture State

/** Resolve function for the pending capture promise. */
type CaptureResolve = (blob: Blob) => void;

/** Reject function for the pending capture promise. */
type CaptureReject = (reason: Error) => void;

// #endregion

// #region Helper Functions

/**
 * Calculates the `bytesPerRow` value required by `copyTextureToBuffer()`.
 * @param width
 * @returns Aligned bytes per row (multiple of 256).
 */
export function alignedBytesPerRow(width: number): number {
    const unaligned = width * BYTES_PER_PIXEL;

    return Math.ceil(unaligned / BYTES_PER_ROW_ALIGNMENT) * BYTES_PER_ROW_ALIGNMENT;
}

/**
 * Swaps BGRA pixel data into RGBA order in place.
 * @param data
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
 * Converts mapped GPU pixel data into a PNG blob.
 *
 * Removes row padding introduced by WebGPU alignment requirements and
 * optionally swizzles BGRA input into RGBA before encoding.
 * @param buffer
 * @param width
 * @param height
 * @param paddedBytesPerRow
 * @param isBGRA
 * @returns Promise resolving to a PNG Blob.
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
 * Coordinates deferred capture of the next rendered frame.
 *
 * A capture request is queued ahead of frame submission, the renderer records a
 * texture-to-buffer copy during `endFrame()`, and the captured data is resolved
 * asynchronously after GPU work completes.
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
