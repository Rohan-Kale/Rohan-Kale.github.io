import test from 'node:test';
import assert from 'node:assert/strict';
import { FlyCamera } from '../src/camera.js';

test('flight matches the native camera axes and 2.5 AU per second speed', () => {
  const camera = new FlyCamera(), start = [...camera.position], direction = camera.direction();
  for (let i = 0; i < 20; i++) camera.move(new Set(['KeyW']), .05);
  camera.position.forEach((v, i) => assert.ok(Math.abs(v - start[i] - direction[i] * 2.5) < 1e-10));
  for (let i = 0; i < 20; i++) camera.move(new Set(['KeyS']), .05);
  camera.position.forEach((v, i) => assert.ok(Math.abs(v - start[i]) < 1e-10));
  camera.move(new Set(['KeyD', 'Space']), .04);
  assert.ok(Math.abs(camera.position[0] - .1) < 1e-10);
  assert.ok(Math.abs(camera.position[1] - 3.1) < 1e-10);
  camera.move(new Set(['KeyA', 'ShiftLeft']), .04);
  assert.ok(Math.abs(camera.position[0]) < 1e-10);
  assert.ok(Math.abs(camera.position[1] - 3) < 1e-10);
});

test('native camera look sensitivity, pitch bounds, and perspective zoom limits', () => {
  const camera = new FlyCamera();
  camera.look(100, -50);
  assert.ok(Math.abs(camera.yaw - (-Math.PI / 2 + .2)) < 1e-10);
  assert.ok(Math.abs(camera.pitch - (-Math.PI / 12 + .1)) < 1e-10);
  camera.look(0, -1e5); assert.equal(camera.pitch, 1.5);
  camera.look(0, 1e5); assert.equal(camera.pitch, -1.5);
  camera.zoom(1e5); assert.equal(camera.fov, Math.PI / 2);
  camera.zoom(-1e5); assert.equal(camera.fov, Math.PI / 18);
  camera.reset(); camera.position = [0, 0, 0]; camera.pitch = 0;
  const m = camera.matrix(1);
  const project = ([x, y, z]) => [0, 1, 2, 3].map((r) => m[r] * x + m[4 + r] * y + m[8 + r] * z + m[12 + r]);
  const close = project([1, 0, -2]), far = project([1, 0, -4]);
  assert.ok(Math.abs(close[0] / close[3] - 2 * far[0] / far[3]) < 1e-6);
  assert.ok(Math.abs(project([0, 0, -.001])[2]) < 1e-6);
  const farPlane = project([0, 0, -100]); assert.ok(Math.abs(farPlane[2] / farPlane[3] - 1) < 1e-6);
});
