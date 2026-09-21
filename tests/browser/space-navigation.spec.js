import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Space tab supports free flight, mouse zoom, and left-click travel to the sun', async ({ page }) => {
  const requests = [], errors = [];
  page.on('request', (r) => requests.push(r.url())); page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/');
  await page.locator('#space-mode').click();
  const canvas = page.locator('#scene canvas'); await expect(canvas).toBeVisible(); await expect(canvas).toBeFocused();
  const initial = await canvas.screenshot();
  await page.keyboard.down('w'); await page.waitForTimeout(250); await page.keyboard.up('w');
  expect((await canvas.screenshot()).equals(initial)).toBe(false);
  await page.keyboard.down('d'); await page.waitForTimeout(100); await page.keyboard.up('d');
  await page.locator('#reset-camera').click();
  expect((await canvas.screenshot()).equals(initial)).toBe(true);
  await canvas.hover(); await page.mouse.wheel(0, -200);
  expect((await canvas.screenshot()).equals(initial)).toBe(false);
  await page.locator('#reset-camera').click();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 30, { steps: 3 });
  await page.mouse.up({ button: 'right' });
  expect((await canvas.screenshot()).equals(initial)).toBe(false);
  await page.locator('#reset-camera').click();
  // The overview looks directly at the central About sun. Click the sphere,
  // rather than its HTML label, to exercise perspective ray picking.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('#about')).toBeVisible(); await expect(page).toHaveURL(/#about$/);
  const arrived = await canvas.screenshot(); expect(arrived.equals(initial)).toBe(false);
  await page.keyboard.down('s'); await page.waitForTimeout(150); await page.keyboard.up('s');
  await expect(page.locator('.portfolio')).toBeHidden(); await expect(page).toHaveURL(/#home$/);
  expect((await canvas.screenshot()).equals(arrived)).toBe(false);
  for (const id of ['experience', 'projects', 'contact']) {
    await page.locator('#reset-camera').click(); await page.locator(`[data-planet="${id}"]`).click();
    await expect(page.locator(`#${id}`)).toBeVisible();
  }
  await page.locator('#reset-camera').click();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  expect(requests.filter((url) => /simulator\.wasm|simulation\.worker/.test(url))).toEqual([]);
  expect(errors).toEqual([]);
});

test('Space returns to Plain when WebGPU is unavailable', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true }));
  await page.goto('/'); await page.locator('#space-mode').click();
  await expect(page.locator('#plain-mode')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#about')).toBeVisible(); await expect(page.locator('#scene canvas')).toHaveCount(0);
  await expect(page.locator('#scene-status')).toContainText('could not load');
});
