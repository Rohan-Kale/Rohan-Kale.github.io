let engine;
self.onmessage = async ({ data }) => {
  try {
    const start = performance.now();
    if (data.type === 'init') {
      const response = await fetch(data.url);
      if (!response.ok) throw new Error('Rust module is unavailable');
      const { instance } = await WebAssembly.instantiate(await response.arrayBuffer(), {});
      engine = instance.exports;
      engine.reset(data.count, data.preset, 42);
    } else if (data.type === 'reset' && engine) {
      engine.reset(data.count, data.preset, 42);
    } else if (data.type === 'tree' && engine) {
      const output = new Float32Array(engine.memory.buffer, engine.data_ptr(), engine.body_count() * 8);
      for (let i = 0; i < engine.body_count(); i++) {
        output.set(data.bodies.subarray(i * 16, i * 16 + 3), i * 8);
        output.set(data.bodies.subarray(i * 16 + 4, i * 16 + 7), i * 8 + 3);
      }
    } else return;
    engine.build_tree();
    const count = engine.body_count();
    const nodes = new Uint8Array(engine.memory.buffer, engine.nodes_ptr(), engine.node_count() * 80).slice();
    const positions = data.type === 'tree' ? null : new Float32Array(engine.memory.buffer, engine.data_ptr(), count * 8).slice();
    postMessage({ type: data.type === 'tree' ? 'tree' : 'ready', generation: data.generation, nodes, positions, count, cost: performance.now() - start }, positions ? [nodes.buffer, positions.buffer] : [nodes.buffer]);
  } catch (error) { postMessage({ type: 'error', generation: data.generation, message: error.message }); }
};
