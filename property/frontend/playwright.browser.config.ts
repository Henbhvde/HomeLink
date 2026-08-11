import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'browser-qa.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  retries: 1,
  expect: { timeout: 15_000 },
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'on-first-retry' },
  projects: [
    { name: 'chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
  ],
  webServer: { command: 'npm.cmd run dev -- --host 127.0.0.1', url: 'http://127.0.0.1:5174', reuseExistingServer: true, timeout: 120_000 },
});
