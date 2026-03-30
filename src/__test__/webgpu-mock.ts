/**
 * Lightweight WebGPU mock factories for unit and integration tests.
 * Provides stub objects that track calls without requiring a real GPU.
 */

// #region GPUTexture

/**
 * Creates a mock GPUTexture.
 *
 * @param width - Texture width in pixels.
 * @param height - Texture height in pixels.
 * @param label - Texture label.
 * @returns Mock GPUTexture stub.
 */
export function createMockGPUTexture(width = 256, height = 256, label = 'MockTexture'): GPUTexture {
    return {
        width,
        height,
        depthOrArrayLayers: 1,
        mipLevelCount: 1,
        sampleCount: 1,
        dimension: '2d',
        format: 'rgba8unorm',
        usage: 0,
        label,
        createView: () => ({ label: 'MockTextureView' }) as unknown as GPUTextureView,
        destroy: () => {},
    } as unknown as GPUTexture;
}

// #endregion

// #region GPURenderPassEncoder

/**
 * Creates a mock GPURenderPassEncoder that records calls.
 *
 * @returns Mock render pass encoder with call tracking.
 */
export function createMockRenderPassEncoder(): GPURenderPassEncoder {
    return {
        setPipeline: () => {},
        setBindGroup: () => {},
        setVertexBuffer: () => {},
        draw: () => {},
        end: () => {},
        label: 'MockRenderPass',
    } as unknown as GPURenderPassEncoder;
}

// #endregion

// #region GPUDevice

/**
 * Creates a mock GPUDevice with stub methods.
 *
 * @returns Mock GPUDevice stub.
 */
export function createMockGPUDevice(): GPUDevice {
    const mockPipeline = {
        getBindGroupLayout: () => ({ label: 'MockBindGroupLayout' }),
        label: 'MockPipeline',
    } as unknown as GPURenderPipeline;

    return {
        createShaderModule: () => ({ label: 'MockShaderModule' }) as unknown as GPUShaderModule,
        createRenderPipeline: () => mockPipeline,
        createBuffer: (desc: GPUBufferDescriptor) =>
            ({
                size: desc.size,
                usage: desc.usage,
                label: desc.label ?? 'MockBuffer',
                mapAsync: () => Promise.resolve(),
                getMappedRange: () => new ArrayBuffer(desc.size),
                unmap: () => {},
                destroy: () => {},
            }) as unknown as GPUBuffer,
        createBindGroup: () => ({ label: 'MockBindGroup' }) as unknown as GPUBindGroup,
        createSampler: () => ({ label: 'MockSampler' }) as unknown as GPUSampler,
        createTexture: (desc: GPUTextureDescriptor) => {
            let width: number;
            let height: number;

            if (typeof desc.size === 'number') {
                width = desc.size;
                height = desc.size;
            } else if (Array.isArray(desc.size)) {
                width = desc.size[0] ?? 256;
                height = desc.size[1] ?? 256;
            } else {
                width = (desc.size as GPUExtent3DDict).width;
                height = (desc.size as GPUExtent3DDict).height ?? 256;
            }

            return createMockGPUTexture(width, height, desc.label ?? 'MockTexture');
        },
        createCommandEncoder: () => ({
            beginRenderPass: () => createMockRenderPassEncoder(),
            finish: () => ({ label: 'MockCommandBuffer' }) as unknown as GPUCommandBuffer,
            label: 'MockCommandEncoder',
        }),
        queue: {
            writeBuffer: () => {}, // uniform/vertex buffer uploads
            writeTexture: () => {}, // r8uint indexed texture uploads
            copyExternalImageToTexture: () => {}, // rgba8unorm image uploads
            submit: () => {}, // command buffer submission
            onSubmittedWorkDone: () => Promise.resolve(), // GPU work completion signal
            label: 'MockQueue',
        },
        features: new Set(),
        limits: {} as GPUSupportedLimits,
        lost: Promise.resolve({ reason: undefined, message: '' } as unknown as GPUDeviceLostInfo),
        destroy: () => {},
        label: 'MockDevice',
    } as unknown as GPUDevice;
}

// #endregion

// #region GPUCanvasContext

/**
 * Creates a mock GPUCanvasContext.
 *
 * @returns Mock GPUCanvasContext stub.
 */
export function createMockGPUCanvasContext(): GPUCanvasContext {
    return {
        configure: () => {},
        getCurrentTexture: () => createMockGPUTexture(),
        canvas: {} as HTMLCanvasElement,
    } as unknown as GPUCanvasContext;
}

// #endregion

// #region Palette Buffer

/**
 * Creates a mock GPUBuffer matching the real 4096-byte palette uniform layout.
 * Returns a plain object — does not call device.createBuffer.
 *
 * @returns Mock GPUBuffer stub.
 */
export function createMockPaletteBuffer(): GPUBuffer {
    return {
        size: 256 * 4 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: 'Mock Palette Buffer',
        mapAsync: () => Promise.resolve(),
        getMappedRange: () => new ArrayBuffer(256 * 4 * 4),
        unmap: () => {},
        destroy: () => {},
    } as unknown as GPUBuffer;
}

// #endregion

// #region Navigator GPU

/**
 * Installs a mock navigator.gpu on globalThis for tests.
 * Call in beforeEach/beforeAll for tests needing WebGPU API presence.
 */
export function installMockNavigatorGPU(): void {
    const mockGPU = {
        requestAdapter: async () => ({
            requestDevice: async () => createMockGPUDevice(),
            features: new Set(),
            limits: {} as GPUSupportedLimits,
            info: { vendor: 'mock', architecture: 'mock', device: 'mock', description: 'Mock GPU' },
        }),
        getPreferredCanvasFormat: () => 'bgra8unorm' as GPUTextureFormat,
    };

    // Use Object.defineProperty to override navigator (may be a getter in Node.js).
    const existingNav = typeof navigator === 'undefined' ? {} : navigator;
    Object.defineProperty(globalThis, 'navigator', {
        value: { ...existingNav, gpu: mockGPU },
        writable: true,
        configurable: true,
    });
}

/**
 * Removes the mock navigator.gpu from globalThis.
 * Call in afterEach/afterAll to clean up.
 */
export function uninstallMockNavigatorGPU(): void {
    if ('navigator' in globalThis) {
        const nav = globalThis.navigator as unknown as Record<string, unknown>;
        delete nav.gpu;
    }
}

// #endregion
