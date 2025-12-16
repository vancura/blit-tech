# WebGPU Conventions

This document covers WebGPU-specific patterns and best practices for the Blit-Tech engine.

## Buffer Management

### Typed Arrays

Use typed arrays for GPU data:

```typescript
// Vertex data - pre-allocated
private vertexData = new Float32Array(MAX_VERTICES * VERTEX_SIZE);
private vertexCount = 0;

// Reset each frame, don't reallocate
beginFrame(): void {
    this.vertexCount = 0;
}
```

### Buffer Strategy

- Pre-allocate buffers at initialization
- Reuse buffers across frames
- Upload data with `device.queue.writeBuffer()`
- Check capacity before adding vertices

```typescript
private hasSpaceForQuad(): boolean {
    return (this.vertexCount + 6) <= MAX_VERTICES;
}

addQuad(...): void {
    if (!this.hasSpaceForQuad()) {
        console.warn('Buffer full, quad dropped');
        return;
    }
    // Add vertices...
}
```

### Uniform Buffers

- Use for data that changes per-frame (resolution, camera)
- Keep small (WebGPU has alignment requirements)
- Update with `writeBuffer()` at frame start

```typescript
// Resolution uniform (vec2<f32>)
const resolutionData = new Float32Array([width, height]);
device.queue.writeBuffer(this.resolutionBuffer, 0, resolutionData);
```

## Texture Handling

### Texture Creation

Standard texture setup for sprites:

```typescript
const texture = device.createTexture({
    size: [width, height],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING |
           GPUTextureUsage.COPY_DST |
           GPUTextureUsage.RENDER_ATTACHMENT,
});
```

### Texture Formats

| Use Case | Format | Notes |
|----------|--------|-------|
| Sprites/images | `rgba8unorm` | Standard 32-bit color |
| Index buffer (palette) | `r8uint` | 8-bit palette indices |
| Render target | `rgba8unorm` | Same as swap chain |

### Sampling

Pixel-perfect rendering requires nearest-neighbor:

```typescript
const sampler = device.createSampler({
    magFilter: 'nearest',
    minFilter: 'nearest',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
});
```

Never use `linear` filtering for pixel art.

### Texture Upload

Upload from ImageBitmap:

```typescript
device.queue.copyExternalImageToTexture(
    { source: imageBitmap },
    { texture: gpuTexture },
    [width, height]
);
```

## Shader Conventions (WGSL)

### Binding Groups

Organize bindings by update frequency:

- **Group 0**: Per-frame uniforms (resolution, camera)
- **Group 1**: Per-material resources (textures, samplers)

```wgsl
// Group 0 - frame uniforms
@group(0) @binding(0) var<uniform> resolution: vec2<f32>;

// Group 1 - texture resources
@group(1) @binding(0) var texSampler: sampler;
@group(1) @binding(1) var texture: texture_2d<f32>;
```

### Vertex Shader Pattern

Standard vertex transformation:

```wgsl
struct VertexInput {
    @location(0) position: vec2<f32>,
    @location(1) color: vec4<f32>,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    // Convert pixel coords to clip space (-1 to 1)
    let normalized = input.position / resolution * 2.0 - 1.0;
    output.position = vec4<f32>(normalized.x, -normalized.y, 0.0, 1.0);
    output.color = input.color;

    return output;
}
```

### Fragment Shader Pattern

Basic textured fragment:

```wgsl
@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    let texColor = textureSample(texture, texSampler, input.texCoord);
    return texColor * input.color;  // Apply tint
}
```

### Palette Lookup (Future)

For indexed color rendering:

```wgsl
@group(0) @binding(0) var<uniform> palette: array<vec4<f32>, 256>;
@group(1) @binding(0) var indexTexture: texture_2d<u32>;

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    let index = textureLoad(indexTexture, vec2<i32>(input.texCoord), 0).r;
    return palette[index];
}
```

## Pipeline Management

### Render Pipeline Setup

Standard pipeline configuration:

```typescript
const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [vertexBufferLayout],
    },
    fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{
            format: presentationFormat,
            blend: {
                color: {
                    srcFactor: 'src-alpha',
                    dstFactor: 'one-minus-src-alpha',
                    operation: 'add',
                },
                alpha: {
                    srcFactor: 'one',
                    dstFactor: 'one-minus-src-alpha',
                    operation: 'add',
                },
            },
        }],
    },
    primitive: {
        topology: 'triangle-list',
    },
});
```

### Multiple Pipelines

Blit-Tech uses separate pipelines for different purposes:

1. **Primitives pipeline** - Colored vertices, no texture
2. **Sprites pipeline** - Textured quads with tint

Each pipeline has its own:

- Shader module
- Vertex buffer layout
- Bind group layout

## Performance Patterns

### Batching

Minimize draw calls by batching:

```typescript
// Bad - one draw call per sprite
for (const sprite of sprites) {
    renderPass.draw(6, 1, sprite.offset, 0);
}

// Good - batch all sprites with same texture
renderPass.draw(totalVertices, 1, 0, 0);
```

### State Changes

State changes are expensive. Minimize:

- Pipeline switches
- Bind group changes
- Texture binds

Sort draw calls by state when possible:

```typescript
// Sort sprites by texture before batching
sprites.sort((a, b) => a.texture.id - b.texture.id);
```

### Texture Atlases

Prefer texture atlases over individual textures:

- Single bind group for all sprites
- No texture switching mid-batch
- Better GPU cache utilization

### Multi-Texture Batching

When texture atlases aren't possible, queue batches:

```typescript
interface SpriteBatch {
    texture: GPUTexture;
    vertices: Float32Array;
    count: number;
}

// Queue batches, render in order
private spriteBatches: SpriteBatch[] = [];
```

## Error Handling

### Device Lost

Handle GPU device loss gracefully:

```typescript
device.lost.then((info) => {
    console.error('WebGPU device lost:', info.message);
    if (info.reason !== 'destroyed') {
        // Attempt recovery - reinitialize
        this.initialize();
    }
});
```

### Validation Errors

Enable validation in development:

```typescript
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice({
    // Validation enabled by default in dev
});

device.onuncapturederror = (event) => {
    console.error('WebGPU error:', event.error.message);
};
```

### Feature Detection

Check for WebGPU support:

```typescript
if (!navigator.gpu) {
    throw new Error('WebGPU not supported in this browser');
}

const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
    throw new Error('No WebGPU adapter available');
}
```

## Memory Management

### Resource Cleanup

Destroy GPU resources when done:

```typescript
class SpriteSheet {
    private texture: GPUTexture | null = null;

    destroy(): void {
        if (this.texture) {
            this.texture.destroy();
            this.texture = null;
        }
    }
}
```

### Bind Group Caching

Cache bind groups to avoid recreation:

```typescript
private bindGroupCache = new Map<GPUTexture, GPUBindGroup>();

getBindGroup(texture: GPUTexture): GPUBindGroup {
    let bindGroup = this.bindGroupCache.get(texture);
    if (!bindGroup) {
        bindGroup = this.createBindGroup(texture);
        this.bindGroupCache.set(texture, bindGroup);
    }
    return bindGroup;
}
```

## Frame Lifecycle

Standard frame structure:

```typescript
beginFrame(): void {
    // Reset counters
    this.primitiveVertexCount = 0;
    this.spriteVertexCount = 0;
    this.spriteBatches = [];
}

// ... drawing calls accumulate vertices ...

endFrame(): void {
    // Upload vertex data
    device.queue.writeBuffer(this.vertexBuffer, 0, this.vertexData);

    // Begin render pass
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass(renderPassDescriptor);

    // Draw primitives
    pass.setPipeline(this.primitivesPipeline);
    pass.draw(this.primitiveVertexCount, 1, 0, 0);

    // Draw sprite batches
    pass.setPipeline(this.spritesPipeline);
    for (const batch of this.spriteBatches) {
        pass.setBindGroup(1, this.getBindGroup(batch.texture));
        pass.draw(batch.count, 1, batch.offset, 0);
    }

    pass.end();
    device.queue.submit([encoder.finish()]);
}
```
