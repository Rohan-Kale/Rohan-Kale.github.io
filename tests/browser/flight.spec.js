import { test, expect } from '@playwright/test';

test('native flight, mouse look, and scroll zoom work while physics is paused', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#simulator');
  await expect(page.locator('#runtime-label')).toHaveText('Rust + WebGPU');
  await expect(page.locator('#sim-count')).toHaveText('10,009 bodies');
  const canvas = page.locator('#sim-canvas');
  await canvas.focus();
  const initial = await canvas.screenshot({ path: '.local/original-3d-system.png' });
  await page.keyboard.down('w'); await page.waitForTimeout(250); await page.keyboard.up('w');
  const moved = await canvas.screenshot(); expect(moved.equals(initial)).toBe(false);
  await expect(page.locator('#sim-time')).toHaveText('0.00 years');
  // Blur must release held flight keys; movement must never leak into form controls.
  await page.keyboard.down('d'); await page.locator('#sim-speed').focus(); await page.keyboard.up('d');
  const unfocused = await canvas.screenshot(); await page.waitForTimeout(100);
  expect((await canvas.screenshot()).equals(unfocused)).toBe(true);
  await canvas.hover(); await page.mouse.wheel(0, -300);
  const zoomed = await canvas.screenshot(); expect(zoomed.equals(unfocused)).toBe(false);
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down({ button: 'right' });
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 50, { steps: 4 }); await page.mouse.up({ button: 'right' });
  expect((await canvas.screenshot()).equals(zoomed)).toBe(false);
  await page.locator('#sim-camera').click();
  expect((await canvas.screenshot()).equals(initial)).toBe(true);
  await page.locator('#close-simulator').click();
  await page.goto('/#simulator'); await expect(page.locator('#runtime-label')).toHaveText('Rust + WebGPU');
});

test('missing WebGPU provides a readable fallback and the portfolio remains usable', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true }));
  await page.goto('/#simulator');
  await expect(page.locator('#sim-message')).toContainText('WebGPU');
  await expect(page.locator('#sim-reset')).toHaveText('Retry');
  await page.locator('#close-simulator').click();
  await page.locator('.section-nav a[href="#about"]').click();
  await expect(page.locator('#about')).toBeVisible();
  await expect(page.locator('.identity .email-link')).toBeVisible();
});

test('actual GPU gravity integrates finite bodies and responds to gravity controls', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { createRenderer } = await import('/src/simulator-renderer.js');
    const wasm = (await WebAssembly.instantiate(await (await fetch('/simulator.wasm')).arrayBuffer(), {})).instance.exports;
    const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 300;
    const errors = [], gpu = await createRenderer(canvas, (error) => errors.push(error));
    function tree(data) {
      if (data) {
        const target = new Float32Array(wasm.memory.buffer, wasm.data_ptr(), wasm.body_count() * 8);
        for (let i = 0; i < wasm.body_count(); i++) { target.set(data.subarray(i * 16, i * 16 + 3), i * 8); target.set(data.subarray(i * 16 + 4, i * 16 + 7), i * 8 + 3); }
      }
      wasm.build_tree(); gpu.setTree(new Uint8Array(wasm.memory.buffer, wasm.nodes_ptr(), wasm.node_count() * 80));
    }
    async function run(count, preset, gravity, steps) {
      wasm.reset(count, preset, 42); gpu.setBodies(new Float32Array(wasm.memory.buffer, wasm.data_ptr(), count * 8)); tree();
      let data;
      for (let i = 0; i < steps; i++) { data = await gpu.step(.001, gravity, .7); if (!data.every(Number.isFinite)) throw new Error('Non-finite GPU result'); tree(data); }
      return Array.from(data);
    }
    try {
      const maximum = await run(10009, 0, 1, 20);
      const lower = await run(64, 1, .5, 40), higher = await run(64, 1, 2, 40);
      return { errors, length: maximum.length, planetZ: maximum[16 + 2], lowX: lower[0], highX: higher[0] };
    } finally { gpu.dispose(); }
  });
  expect(result.errors).toEqual([]); expect(result.length).toBe(10009 * 16);
  expect(Math.abs(result.planetZ)).toBeGreaterThan(.01);
  expect(Math.abs(result.lowX - result.highX)).toBeGreaterThan(.005);
});
