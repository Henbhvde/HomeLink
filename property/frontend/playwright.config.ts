import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 1,
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'on-first-retry' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['iPhone 12'] } },
    { name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
  ],
  webServer: [
    { command: 'npm.cmd run dev', cwd: '../backend', url: 'http://127.0.0.1:3001/health', reuseExistingServer: true, timeout: 120_000 },
    { command: 'npm.cmd run dev -- --host 127.0.0.1', url: 'http://127.0.0.1:5174', reuseExistingServer: true, timeout: 120_000 },
  ],
});
