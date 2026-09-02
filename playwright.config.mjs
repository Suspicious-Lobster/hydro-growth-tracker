import { defineConfig } from '@playwright/test';

// End-to-end suite: launches the real Electron app (main.js + the built
// frontend in frontend/dist) against a temp user-data folder. One worker: it
// owns the screen. Run with `npm run test:e2e` (which builds the frontend
// first).
export default defineConfig({
  testDir: 'e2e',
  testMatch: /.*\.spec\.mjs/,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  outputDir: 'e2e/.results',
  use: {
    trace: 'retain-on-failure',
  },
});
