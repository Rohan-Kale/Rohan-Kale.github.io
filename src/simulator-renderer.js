import particleCode from './shaders/particle.wgsl?raw';
import starCode from './shaders/star.wgsl?raw';
import velocityCode from './shaders/velocity.wgsl?raw';
import gravityCode from './shaders/gravity.wgsl?raw';

import { sphereMesh } from './geometry.js';

export async function createRenderer(canvas, onFailure) {
  if (!navigator.gpu) throw new Error('3D requires WebGPU. Open this page in a browser with WebGPU enabled.');
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('No WebGPU graphics adapter is available. Check browser hardware acceleration.');
  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  if (!context) { device.destroy(); throw new Error('WebGPU canvas is unavailable.'); }
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });
  try {
  let disposed = false, count = 0, depth, body, snapshot, readback, nodes, gravityGroup, velocityGroup;
  const buffers = new Set();
  function buffer(label, size, usage, data) {
    const result = device.createBuffer({ label, size: Math.max(4, size), usage });
    if (data) device.queue.writeBuffer(result, 0, data);
    buffers.add(result); return result;
  }
  function destroy(b) { if (b) { b.destroy(); buffers.delete(b); } }
  const U = GPUBufferUsage;
  const cameraBuffer = buffer('Original CameraUniform', 64, U.UNIFORM | U.COPY_DST);
  const params = buffer('Simulation parameters', 16, U.UNIFORM | U.COPY_DST);
  const cameraLayout = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }] });
  const cameraGroup = device.createBindGroup({ layout: cameraLayout, entries: [{ binding: 0, resource: { buffer: cameraBuffer } }] });
  const renderLayout = device.createPipelineLayout({ bindGroupLayouts: [cameraLayout] });
  const particle = device.createShaderModule({ label: 'Original particle.wgsl', code: particleCode });
  const star = device.createShaderModule({ label: 'Original star.wgsl', code: starCode });
  const velocity = device.createShaderModule({ label: 'Original velocity.wgsl', code: velocityCode });
  const gravity = device.createShaderModule({ label: 'Adapted original gravity.wgsl', code: gravityCode });
  const depthState = { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' };
  const bodyPipeline = await device.createRenderPipelineAsync({ label: 'Original instanced spheres', layout: renderLayout,
    vertex: { module: particle, entryPoint: 'vs_main', buffers: [
      { arrayStride: 32, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' }, { shaderLocation: 2, offset: 24, format: 'float32x2' }] },
      { arrayStride: 64, stepMode: 'instance', attributes: [{ shaderLocation: 3, offset: 0, format: 'float32x3' }, { shaderLocation: 4, offset: 52, format: 'float32' }] }
    ] }, fragment: { module: particle, entryPoint: 'fs_main', targets: [{ format }] }, primitive: { topology: 'triangle-list', cullMode: 'none' }, depthStencil: depthState });
  const starPipeline = await device.createRenderPipelineAsync({ layout: renderLayout,
    vertex: { module: star, entryPoint: 'vs_main', buffers: [{ arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] }] },
    fragment: { module: star, entryPoint: 'fs_main', targets: [{ format }] }, primitive: { topology: 'point-list' }, depthStencil: { ...depthState, depthWriteEnabled: false, depthCompare: 'always' } });
  const velocityLayout = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }] });
  const velocityPipeline = await device.createRenderPipelineAsync({ layout: device.createPipelineLayout({ bindGroupLayouts: [velocityLayout, cameraLayout] }),
    vertex: { module: velocity, entryPoint: 'vs_main' }, fragment: { module: velocity, entryPoint: 'fs_main', targets: [{ format }] }, primitive: { topology: 'line-list' }, depthStencil: depthState });
  const gravityPipeline = await device.createComputePipelineAsync({ layout: 'auto', compute: { module: gravity, entryPoint: 'main' } });
  const mesh = sphereMesh();
  const vertices = buffer('Original sphere vertices', mesh.vertices.byteLength, U.VERTEX | U.COPY_DST, mesh.vertices);
  const indices = buffer('Original sphere indices', mesh.indices.byteLength, U.INDEX | U.COPY_DST, mesh.indices);
  const stars = new Float32Array(5000 * 3);
  let seed = 42;
  for (let i = 0; i < stars.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; stars[i] = seed / 4294967296 * 200 - 100; }
  const starBuffer = buffer('Original 5000-star volume', stars.byteLength, U.VERTEX | U.COPY_DST, stars);
  const trailPipeline = await device.createRenderPipelineAsync({ layout: renderLayout,
    vertex: { module: star, entryPoint: 'vs_main', buffers: [{ arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] }] },
    fragment: { module: star, entryPoint: 'fs_main', targets: [{ format }] }, primitive: { topology: 'line-list' }, depthStencil: { ...depthState, depthWriteEnabled: false } });
  const trailBuffer = buffer('Bounded 3D trails', 350 * 18 * 2 * 3 * 4, U.VERTEX | U.COPY_DST);
  let trailCount = 0;
  function bindGravity() {
    if (!body || !nodes) return;
    gravityGroup = device.createBindGroup({ layout: gravityPipeline.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: body } }, { binding: 1, resource: { buffer: nodes } }, { binding: 2, resource: { buffer: params } }, { binding: 3, resource: { buffer: snapshot } }
    ] });
  }
  device.lost.then((info) => { if (!disposed) onFailure(`Graphics device lost: ${info.message || info.reason}`); });
  device.addEventListener('uncapturederror', (event) => { if (!disposed) onFailure(event.error.message); });
  return {
    setBodies(data) {
      count = data.length / 8; [body, snapshot, readback].forEach(destroy);
      const packed = new Float32Array(count * 16);
      for (let i = 0; i < count; i++) { packed.set(data.subarray(i * 8, i * 8 + 3), i * 16); packed.set(data.subarray(i * 8 + 3, i * 8 + 6), i * 16 + 4); packed[i * 16 + 12] = data[i * 8 + 6]; packed[i * 16 + 13] = data[i * 8 + 7]; }
      body = buffer('Original GpuBody layout', packed.byteLength, U.STORAGE | U.VERTEX | U.COPY_SRC | U.COPY_DST, packed);
      snapshot = buffer('Physics input snapshot', packed.byteLength, U.STORAGE | U.COPY_DST);
      readback = buffer('Positions for Rust octree', packed.byteLength, U.MAP_READ | U.COPY_DST);
      velocityGroup = device.createBindGroup({ layout: velocityLayout, entries: [{ binding: 0, resource: { buffer: body } }] });
      bindGravity(); trailCount = 0;
    },
    setTree(data) {
      if (!nodes || nodes.size < data.byteLength) { destroy(nodes); nodes = buffer('Rust flattened octree', data.byteLength, U.STORAGE | U.COPY_DST); bindGravity(); }
      device.queue.writeBuffer(nodes, 0, data);
    },
    async step(dt, gravityScale, theta) {
      if (!gravityGroup || disposed) return null;
      const target = readback;
      device.queue.writeBuffer(params, 0, new Float32Array([dt, gravityScale, theta, 0]));
      const encoder = device.createCommandEncoder();
      encoder.copyBufferToBuffer(body, 0, snapshot, 0, body.size);
      const pass = encoder.beginComputePass(); pass.setPipeline(gravityPipeline); pass.setBindGroup(0, gravityGroup); pass.dispatchWorkgroups(Math.ceil(count / 64)); pass.end();
      encoder.copyBufferToBuffer(body, 0, target, 0, body.size); device.queue.submit([encoder.finish()]);
      await target.mapAsync(GPUMapMode.READ);
      const data = new Float32Array(target.getMappedRange()).slice(); target.unmap(); return data;
    },
    trails(history) {
      const lines = [], stride = Math.max(1, Math.ceil(count / 350));
      for (let frame = 1; frame < history.length; frame++) for (let i = 0; i < count; i += stride) {
        lines.push(...history[frame - 1].subarray(i * 16, i * 16 + 3), ...history[frame].subarray(i * 16, i * 16 + 3));
      }
      trailCount = lines.length / 3;
      if (lines.length) device.queue.writeBuffer(trailBuffer, 0, new Float32Array(lines));
    },
    draw(matrix, vectors) {
      if (disposed || !canvas.width || !canvas.height) return;
      if (!depth || depth.width !== canvas.width || depth.height !== canvas.height) { depth?.destroy(); depth = device.createTexture({ size: [canvas.width, canvas.height], format: 'depth32float', usage: GPUTextureUsage.RENDER_ATTACHMENT }); }
      device.queue.writeBuffer(cameraBuffer, 0, matrix);
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }], depthStencilAttachment: { view: depth.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } });
      pass.setPipeline(starPipeline); pass.setBindGroup(0, cameraGroup); pass.setVertexBuffer(0, starBuffer); pass.draw(5000);
      if (body) {
        if (trailCount) { pass.setPipeline(trailPipeline); pass.setVertexBuffer(0, trailBuffer); pass.draw(trailCount); }
        pass.setPipeline(bodyPipeline); pass.setBindGroup(0, cameraGroup); pass.setVertexBuffer(0, vertices); pass.setVertexBuffer(1, body); pass.setIndexBuffer(indices, 'uint32'); pass.drawIndexed(mesh.indices.length, count);
        if (vectors) { pass.setPipeline(velocityPipeline); pass.setBindGroup(0, velocityGroup); pass.setBindGroup(1, cameraGroup); pass.draw(2, count); }
      }
      pass.end(); device.queue.submit([encoder.finish()]);
    },
    dispose() { disposed = true; buffers.forEach((b) => b.destroy()); depth?.destroy(); context.unconfigure(); device.destroy(); }
  };
  } catch (error) {
    context.unconfigure(); device.destroy(); throw error;
  }
}
