import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('plain portfolio is one screen, loads no simulator, and swaps all sections', async ({ page }) => {
  const requests = [], errors = [];
  page.on('request', (request) => requests.push(request.url())); page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#plain-mode')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#about')).toBeVisible();
  await expect(page.locator('.identity .role, .identity .intro, .section-forward, .project details, .launch-simulator')).toHaveCount(0);
  await expect(page.locator('.identity .email-link')).toHaveAttribute('href', 'mailto:kalerohan42@gmail.com');
  await expect(page.locator('.identity .email-link')).toBeInViewport();
  await expect(page.locator('.identity a').filter({ hasText: 'Resume' })).toBeInViewport();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await page.screenshot({ path: '.local/plain-desktop.png' });
  for (const id of ['projects', 'experience', 'contact', 'about']) {
    await page.locator(`.section-nav a[href="#${id}"]`).click();
    await expect(page.locator(`#${id}`)).toBeVisible();
    await expect(page.locator('.content-section:visible')).toHaveCount(1);
    await expect(page.locator(`#${id}`)).toBeFocused();
  }
  expect(requests.filter((url) => /scene\.js|simulator\.wasm|simulation\.worker/.test(url))).toEqual([]);
  expect(errors).toEqual([]);
  await page.goto('/#skills');
  await expect(page.locator('#experience-title')).toHaveText('Experience');
  await expect(page.locator('#skills')).toBeVisible();
  await expect(page.locator('.section-nav a')).toHaveCount(4);
});

test('space mode has category bodies, travels to content, and switches back', async ({ page }) => {
  // Freeze decorative orbit motion so pointer selection does not chase a label.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#space-mode').click();
  await expect(page.locator('#scene canvas')).toBeVisible();
  await expect(page.locator('.portfolio')).toBeHidden();
  await expect(page.locator('.identity')).toBeHidden();
  await expect(page.locator('.space-directory')).toHaveCount(0);
  await expect(page.locator('[data-planet="galaxy"]')).toBeInViewport();
  await page.screenshot({ path: '.local/space-desktop.png' });
  await page.locator('[data-planet="projects"]').click();
  await expect(page.locator('#projects')).toBeVisible();
  await expect(page).toHaveURL(/#projects$/);
  await page.getByRole('button', { name: 'Back to solar system' }).click();
  await expect(page.locator('.portfolio')).toBeHidden();
  await page.locator('[data-planet="contact"]').click();
  await expect(page.locator('#contact')).toBeVisible();
  await page.locator('#plain-mode').click();
  await expect(page.locator('#scene')).toBeHidden();
  await expect(page.locator('#contact')).toBeVisible();
  await page.reload();
  await expect(page.locator('#plain-mode')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#space-mode').click();
  await page.locator('[data-planet="experience"]').click();
  await expect(page.locator('#experience-title')).toBeVisible();
});

test('Rust playground changes actual body count, runs, pauses, resets, and supports camera input', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#projects');
  await page.locator('#space-mode').click();
  await page.getByRole('link', { name: 'create your own galaxy' }).click();
  await expect(page.locator('#simulator-dialog')).toBeVisible();
  await expect(page.locator('#sim-count')).toHaveText('10,009 bodies');
  await expect(page.locator('#runtime-label')).toHaveText('Rust + WebGPU');
  await expect(page.locator('#sim-pause')).toHaveText('Resume');
  await page.locator('#body-count').focus(); await page.keyboard.press('Home');
  await expect(page.locator('#sim-count')).toHaveText('16 bodies');
  await page.keyboard.press('End');
  await expect(page.locator('#sim-count')).toHaveText('10,009 bodies');
  await page.locator('#sim-preset').selectOption('2');
  await expect(page.locator('#sim-time')).toHaveText('0.00 years');
  await page.locator('#sim-pause').click();
  await expect(page.locator('#sim-time')).not.toHaveText('0.00 years');
  await page.locator('#sim-pause').click();
  await page.locator('#sim-vectors').check();
  await page.locator('#sim-canvas').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('+');
  await page.screenshot({ path: '.local/rust-playground.png' });
  await page.locator('#sim-reset').click();
  await expect(page.locator('#sim-time')).toHaveText('0.00 years');
  await expect(page.locator('#sim-count')).toHaveText('10,009 bodies');
  await page.keyboard.press('Escape');
  await expect(page.locator('#simulator-dialog')).toBeHidden();
  expect(errors).toEqual([]);
});

test('fallbacks preserve content when scripts, graphics, or WASM are unavailable', async ({ page, browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await context.newPage(); await staticPage.goto('http://127.0.0.1:5173/');
  await staticPage.locator('.section-nav a[href="#projects"]').click();
  await expect(staticPage.locator('#space-simulator h3')).toHaveText('Kale Space Program'); await context.close();
  await page.route(/\/src\/scene\.js(?:\?.*)?$/, (route) => route.abort());
  await page.goto('/'); await page.locator('#space-mode').click();
  await expect(page.locator('#plain-mode')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#scene-status')).toContainText('could not load');
  await page.route('**/simulator.wasm', (route) => route.abort());
  await page.goto('/#simulator');
  await expect(page.locator('#sim-message')).toContainText('could not load');
  await expect(page.locator('#sim-reset')).toHaveText('Retry');
  await page.unroute('**/simulator.wasm'); await page.locator('#sim-reset').click();
  await expect(page.locator('#sim-count')).toHaveText('10,009 bodies');
  await page.keyboard.press('Escape'); await expect(page.locator('#projects')).toBeVisible();
});

test('compact responsive layouts and accessible portfolio and simulator controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 850 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await expect(page.locator('.identity .email-link')).toBeInViewport();
    await page.screenshot({ path: `.local/compact-${width}.png` });
  }
  await page.goto('/#simulator');
  await expect(page.locator('#sim-count')).toHaveText('10,009 bodies');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 850 });
  await expect(page.locator('#close-simulator')).toBeInViewport();
  await page.screenshot({ path: '.local/playground-mobile.png' });
  await page.keyboard.press('Escape');
  await page.locator('#space-mode').click();
  await expect(page.locator('#scene canvas')).toBeVisible();
  await page.screenshot({ path: '.local/space-mobile.png' });
});


