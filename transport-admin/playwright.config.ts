import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end CRUD tests for the admin dashboard. They create, edit and delete real rows, so they
 * only run against a local database (see e2e/README.md); global-setup refuses any other host.
 */
const PORT = Number(process.env.E2E_PORT || 3102);
const DATABASE_URL = process.env.E2E_DATABASE_URL || 'postgresql://postgres@127.0.0.1:55432/transport_test';

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/test-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e/report' }]],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    storageState: 'e2e/.auth/admin.json',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Serves the production build (`npm run build` first). `next start` is used instead of
  // `next dev` because Next allows only one dev server per folder.
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    // A server left on the port may serve an older build; set E2E_REUSE_SERVER=1 to use it anyway.
    reuseExistingServer: Boolean(process.env.E2E_REUSE_SERVER),
    timeout: 180_000,
    env: {
      DATABASE_URL,
      ADMIN_SESSION_SECRET: 'e2e-local-session-secret-not-for-production',
    },
  },
});
