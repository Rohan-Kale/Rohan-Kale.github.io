import { test, expect } from '@playwright/test';

test('step and octree timings stay separate, update slowly, and fit mobile', async ({ page }) => {
  await page.goto('/#simulator');
  await expect(page.locator('#sim-step-time')).toHaveText(/^Step \d+\.\d ms$/);
  await expect(page.locator('#sim-tree-time')).toHaveText(/^Octree \d+\.\d ms$/);
  const changes = await page.evaluate(async () => {
    const records = { step: [], tree: [] };
    const observers = Object.entries({ step: 'sim-step-time', tree: 'sim-tree-time' }).map(([key, id]) => {
      const target = document.getElementById(id);
      const observer = new MutationObserver(() => records[key].push({ time: performance.now(), text: target.textContent }));
      observer.observe(target, { childList: true }); return observer;
    });
    await new Promise((resolve) => setTimeout(resolve, 1600));
    observers.forEach((observer) => observer.disconnect()); return records;
  });
  for (const [kind, records] of Object.entries(changes)) {
    expect(records.length).toBeGreaterThan(0); expect(records.length).toBeLessThanOrEqual(4);
    for (let i = 1; i < records.length; i++) expect(records[i].time - records[i - 1].time).toBeGreaterThanOrEqual(450);
    expect(records.every((r) => r.text.startsWith(kind === 'step' ? 'Step ' : 'Octree '))).toBe(true);
  }
  await page.locator('#sim-pause').click();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const step = await page.locator('#sim-step-time').boundingBox(), tree = await page.locator('#sim-tree-time').boundingBox(), stage = await page.locator('.sim-stage').boundingBox();
    expect(step.x + step.width <= tree.x + .5 || step.y + step.height <= tree.y + .5).toBe(true);
    for (const rect of [step, tree]) { expect(rect.x).toBeGreaterThanOrEqual(stage.x); expect(rect.x + rect.width).toBeLessThanOrEqual(stage.x + stage.width); }
    await page.screenshot({ path: `.local/timings-${width}.png` });
  }
});
