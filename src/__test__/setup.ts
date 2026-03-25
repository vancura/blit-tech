// Global test setup for blit-tech.
// Imported by vitest.config.ts setupFiles.

// Provide WebGPU constants that don't exist in Node.js.
if (typeof GPUBufferUsage === 'undefined') {
    (globalThis as unknown as Record<string, unknown>).GPUBufferUsage = {
        MAP_READ: 0x0001,
        MAP_WRITE: 0x0002,
        COPY_SRC: 0x0004,
        COPY_DST: 0x0008,
        INDEX: 0x0010,
        VERTEX: 0x0020,
        UNIFORM: 0x0040,
        STORAGE: 0x0080,
        INDIRECT: 0x0100,
        QUERY_RESOLVE: 0x0200,
    };
}

if (typeof GPUTextureUsage === 'undefined') {
    (globalThis as unknown as Record<string, unknown>).GPUTextureUsage = {
        COPY_SRC: 0x01,
        COPY_DST: 0x02,
        TEXTURE_BINDING: 0x04,
        STORAGE_BINDING: 0x08,
        RENDER_ATTACHMENT: 0x10,
    };
}
