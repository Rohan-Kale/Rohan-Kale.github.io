import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const bytes = await readFile(new URL('../public/simulator.wasm', import.meta.url));
async function load() { return (await WebAssembly.instantiate(bytes, {})).instance.exports; }
function snapshot(engine) { return new Float32Array(engine.memory.buffer, engine.data_ptr(), engine.body_count() * 8).slice(); }
test('shipped Rust WASM respects body limits and deterministic resets', async () => {
  const engine = await load();
  engine.reset(512, 2, 42); const before = snapshot(engine);
  engine.step(.003, 1, .7); assert.notDeepEqual(snapshot(engine), before);
  engine.reset(512, 2, 42); assert.deepEqual(snapshot(engine), before); assert.equal(engine.elapsed(), 0);
  engine.reset(1, 0, 42); assert.equal(engine.body_count(), 16);
  engine.reset(999999, 0, 42); assert.equal(engine.body_count(), 10009);
});
test('solar, binary, and disk systems remain finite at the maximum body count', async () => {
  const engine = await load();
  for (const preset of [0, 1, 2]) {
    engine.reset(10009, preset, 42);
    for (let step = 0; step < 100; step++) engine.step(.001, 1, .7);
    assert.ok(snapshot(engine).every(Number.isFinite));
    assert.ok(engine.elapsed() > .099);
  }
});
test('gravity control changes the integrated motion, not just the display', async () => {
  const engine = await load();
  engine.reset(64, 1, 42);
  for (let i = 0; i < 100; i++) engine.step(.002, .5, .4);
  const lowerGravity = snapshot(engine);
  engine.reset(64, 1, 42);
  for (let i = 0; i < 100; i++) engine.step(.002, 2, .4);
  const higherGravity = snapshot(engine);
  assert.ok(Math.abs(lowerGravity[0] - higherGravity[0]) > .05);
});

test('Rust exports a valid 80-byte GPU octree and rebuilds from GPU positions', async () => {
  const engine = await load();
  engine.reset(10009, 0, 42); engine.build_tree();
  assert.ok(engine.node_count() > 10009);
  let view = new DataView(engine.memory.buffer, engine.nodes_ptr(), engine.node_count() * 80);
  assert.ok(view.getFloat32(32, true) > 1);
  for (let n = 0; n < engine.node_count(); n++) {
    for (let c = 0; c < 8; c++) { const child = view.getUint32(n * 80 + 48 + c * 4, true); assert.ok(child === 0xffffffff || child < engine.node_count()); }
  }
  const data = new Float32Array(engine.memory.buffer, engine.data_ptr(), engine.body_count() * 8);
  for (let i = 0; i < engine.body_count(); i++) data[i * 8] += 200;
  engine.build_tree(); view = new DataView(engine.memory.buffer, engine.nodes_ptr(), 80);
  assert.ok(view.getFloat32(0, true) > 199);
  assert.ok(view.getFloat32(28, true) > 230);
});
