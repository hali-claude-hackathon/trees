import { defineConfig, devices } from '@playwright/test';

export const DEV_URL = 'http://localhost:5173';
export const PREVIEW_URL = 'http://localhost:4173';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // The `github` and `list` reporters are stdout-only and write nothing to
  // disk; only the `html` reporter produces the playwright-report/ directory
  // that CI uploads as a diagnostic artifact on failure.
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: DEV_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Two servers: the dev server for the behavioural specs, and a preview server
  // of the real production build for the service-worker/offline spec.
  webServer: [
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      url: DEV_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run build && npm run preview -- --port 4173 --strictPort',
      url: PREVIEW_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
