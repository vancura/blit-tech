/**
 * WebGPU demo entry point.
 * Displays a simple triangle to verify WebGPU is working.
 * This is a standalone test, not part of the Blit-Tech engine.
 */
async function main() {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement | null;

    if (!canvas) {
        showError('Canvas element not found');
        return;
    }

    // Check WebGPU support
    if (!navigator.gpu) {
        showError('WebGPU is not supported in this browser.');
        return;
    }

    // Request adapter and device
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        showError('Failed to get GPU adapter.');
        return;
    }

    const device = await adapter.requestDevice();

    // Configure canvas context
    const context = canvas.getContext('webgpu');
    if (!context) {
        showError('Failed to get WebGPU context.');
        return;
    }

    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device,
        format,
        alphaMode: 'opaque',
    });

    // Vertex shader - defines a triangle
    const vertexShaderCode = `
    @vertex
    fn main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
      var positions = array<vec2f, 3>(
        vec2f(0.0, 0.5),   // top
        vec2f(-0.5, -0.5), // bottom left
        vec2f(0.5, -0.5)   // bottom right
      );
      return vec4f(positions[vertexIndex], 0.0, 1.0);
    }
  `;

    // Fragment shader - colors the triangle
    const fragmentShaderCode = `
    @fragment
    fn main() -> @location(0) vec4f {
      return vec4f(0.2, 0.6, 1.0, 1.0); // Nice blue color
    }
  `;

    // Create shader modules
    const vertexShaderModule = device.createShaderModule({
        label: 'Vertex Shader',
        code: vertexShaderCode,
    });

    const fragmentShaderModule = device.createShaderModule({
        label: 'Fragment Shader',
        code: fragmentShaderCode,
    });

    // Create render pipeline
    const pipeline = device.createRenderPipeline({
        label: 'Triangle Pipeline',
        layout: 'auto',
        vertex: {
            module: vertexShaderModule,
            entryPoint: 'main',
        },
        fragment: {
            module: fragmentShaderModule,
            entryPoint: 'main',
            targets: [
                {
                    format,
                },
            ],
        },
        primitive: {
            topology: 'triangle-list',
        },
    });

    /**
     * Renders a single frame with the demo triangle.
     * Clears to dark gray and draws a blue triangle.
     */
    function render() {
        const commandEncoder = device.createCommandEncoder();
        const textureView = context!.getCurrentTexture().createView();

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: textureView,
                    clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        });

        renderPass.setPipeline(pipeline);
        renderPass.draw(3); // 3 vertices for triangle
        renderPass.end();

        device.queue.submit([commandEncoder.finish()]);
    }

    // Initial render
    render();

    // Update info
    const info = document.getElementById('info');
    if (info) {
        info.textContent = `WebGPU Demo - Adapter: ${adapter.info?.description ?? 'Unknown'}`;
    }

    console.log('WebGPU initialized successfully!');
    console.log('Adapter:', adapter.info);
    console.log('Device:', device);
}

/**
 * Displays an error message to the user.
 * Shows in both the page error div and console.
 * @param message - Error description to display.
 */
function showError(message: string) {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
        errorDiv.textContent = `Error: ${message}`;
    }
    console.error(message);
}

// Start the application
main().catch((error) => {
    showError(`Initialization failed: ${error instanceof Error ? error.message : String(error)}`);
});
