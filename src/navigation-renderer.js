import { sphereMesh } from './geometry.js';
import particleCode from './shaders/particle.wgsl?raw';

// The portfolio uses the simulator's sphere shader and perspective/depth model.
// Only five destinations are drawn; it does not load the physics worker or WASM.
export async function createNavigationRenderer(canvas, definitions, onFailure) {
  if (!navigator.gpu) throw new Error('WebGPU unavailable');
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('3D graphics unavailable');
  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  if (!context) { device.destroy(); throw new Error('WebGPU canvas unavailable'); }
  const buffers = [], format = navigator.gpu.getPreferredCanvasFormat();
  let depth, disposed = false;
  const dispose = () => { disposed = true; buffers.forEach((b) => b.destroy()); depth?.destroy(); context.unconfigure(); device.destroy(); };
  try {
    context.configure({ device, format, alphaMode: 'opaque' });
    const makeBuffer = (size, usage, data) => { const b = device.createBuffer({ size, usage: usage | GPUBufferUsage.COPY_DST }); if (data) device.queue.writeBuffer(b, 0, data); buffers.push(b); return b; };
    const camera = makeBuffer(64, GPUBufferUsage.UNIFORM);
    const layout = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }] });
    const group = device.createBindGroup({ layout, entries: [{ binding: 0, resource: { buffer: camera } }] });
    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
    const shader = device.createShaderModule({ code: particleCode });
    const depthState = { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' };
    const bodyPipeline = await device.createRenderPipelineAsync({ layout: pipelineLayout,
      vertex: { module: shader, entryPoint: 'vs_main', buffers: [
        { arrayStride: 32, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' }, { shaderLocation: 2, offset: 24, format: 'float32x2' }] },
        { arrayStride: 16, stepMode: 'instance', attributes: [{ shaderLocation: 3, offset: 0, format: 'float32x3' }, { shaderLocation: 4, offset: 12, format: 'float32' }] }
      ] }, fragment: { module: shader, entryPoint: 'fs_main', targets: [{ format }] }, primitive: { topology: 'triangle-list' }, depthStencil: depthState });
    const lineShader = device.createShaderModule({ code: `
      struct Camera { view_proj: mat4x4<f32> }; @group(0) @binding(0) var<uniform> camera: Camera;
      @vertex fn vs_main(@location(0) p: vec3<f32>) -> @builtin(position) vec4<f32> { return camera.view_proj * vec4<f32>(p, 1.0); }
      @fragment fn fs_main() -> @location(0) vec4<f32> { return vec4<f32>(0.10, 0.13, 0.18, 1.0); }
      @fragment fn star_main() -> @location(0) vec4<f32> { return vec4<f32>(0.32, 0.37, 0.45, 1.0); }
    ` });
    const simplePipeline = (topology, entryPoint) => device.createRenderPipelineAsync({ layout: pipelineLayout,
      vertex: { module: lineShader, entryPoint: 'vs_main', buffers: [{ arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] }] },
      fragment: { module: lineShader, entryPoint, targets: [{ format }] }, primitive: { topology }, depthStencil: { ...depthState, depthWriteEnabled: false } });
    const lines = await simplePipeline('line-list', 'fs_main'), stars = await simplePipeline('point-list', 'star_main');
    const mesh = sphereMesh(), vertices = makeBuffer(mesh.vertices.byteLength, GPUBufferUsage.VERTEX, mesh.vertices), indices = makeBuffer(mesh.indices.byteLength, GPUBufferUsage.INDEX, mesh.indices);
    const bodies = makeBuffer(definitions.length * 16, GPUBufferUsage.VERTEX);
    const orbitPoints = [];
    for (const { orbit } of definitions) if (orbit) for (let i = 0; i < 160; i++) for (const j of [i, i + 1]) { const a = j / 160 * 2 * Math.PI; orbitPoints.push(Math.cos(a) * orbit, 0, Math.sin(a) * orbit); }
    const orbitBuffer = makeBuffer(orbitPoints.length * 4, GPUBufferUsage.VERTEX, new Float32Array(orbitPoints));
    const starPoints = new Float32Array(700 * 3); let seed = 927;
    for (let i = 0; i < starPoints.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; starPoints[i] = seed / 4294967296 * 160 - 80; }
    const starBuffer = makeBuffer(starPoints.byteLength, GPUBufferUsage.VERTEX, starPoints);
    device.lost.then(() => { if (!disposed) onFailure(); });
    device.addEventListener('uncapturederror', () => { if (!disposed) onFailure(); });
    return {
      draw(matrix, positions) {
        if (disposed) return;
        if (!depth || depth.width !== canvas.width || depth.height !== canvas.height) { depth?.destroy(); depth = device.createTexture({ size: [canvas.width, canvas.height], format: 'depth32float', usage: GPUTextureUsage.RENDER_ATTACHMENT }); }
        device.queue.writeBuffer(camera, 0, matrix); device.queue.writeBuffer(bodies, 0, positions);
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: { r: .012, g: .016, b: .023, a: 1 }, loadOp: 'clear', storeOp: 'store' }], depthStencilAttachment: { view: depth.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } });
        pass.setBindGroup(0, group); pass.setPipeline(stars); pass.setVertexBuffer(0, starBuffer); pass.draw(700);
        pass.setPipeline(lines); pass.setVertexBuffer(0, orbitBuffer); pass.draw(orbitPoints.length / 3);
        pass.setPipeline(bodyPipeline); pass.setVertexBuffer(0, vertices); pass.setVertexBuffer(1, bodies); pass.setIndexBuffer(indices, 'uint32'); pass.drawIndexed(mesh.indices.length, definitions.length);
        pass.end(); device.queue.submit([encoder.finish()]);
      }, dispose
    };
  } catch (error) { dispose(); throw error; }
}
