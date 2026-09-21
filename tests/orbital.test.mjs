import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { angularVelocity, orbitalPosition } from '../src/orbital.js';
import { G, planets } from '../src/generated/solar-system.js';

test('orbital motion follows the Rust initializer’s solar-unit period', () => {
  assert.ok(Math.abs(angularVelocity(1) - 2 * Math.PI) < 1e-6);
  const initial = orbitalPosition(6, .3, 0, 1);
  const afterOneYear = orbitalPosition(6, .3, 1, 1);
  initial.forEach((value, i) => assert.ok(Math.abs(value - afterOneYear[i]) < 1e-5));
  assert.throws(() => angularVelocity(0), RangeError);
});
test('Rust solar-system configuration is reused without inventing planet data', () => {
  assert.equal(G, 39.4784176);
  assert.equal(planets.length, 8);
  assert.deepEqual(planets[2], { name: 'Earth', mass: 3e-6, distance: 1, radius: .05 });
});
test('all content and project links are present in HTML without JavaScript', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['about', 'projects', 'skills', 'experience', 'contact', 'space-simulator']) assert.ok(html.includes(`id="${id}"`));
  assert.ok(html.includes('https://github.com/Rohan-Kale/space-simulator'));
  assert.ok(html.includes('create your own galaxy'));
  assert.ok(!html.includes('{{'));
});
