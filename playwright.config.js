import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  reporter: 'list',
  use: { baseURL: process.env.PORTFOLIO_TEST_URL || 'http://127.0.0.1:5173', channel: 'chrome', headless: true, viewport: { width: 1440, height: 1000 } }
});
