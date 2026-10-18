import { defineConfig, devices } from '@playwright/test';

/**
 * Testes ponta a ponta (CRUD) do painel de administração. Criam, editam e apagam linhas reais, por
 * isso só correm contra uma base de dados local (ver e2e/README.md); o global-setup recusa qualquer outro servidor.
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
  // Serve a versão de produção (`npm run build` primeiro). Usa-se `next start` em vez de
  // `next dev` porque o Next só permite um servidor de desenvolvimento por pasta.
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    // Um servidor deixado na porta pode servir uma versão antiga; E2E_REUSE_SERVER=1 usa-o mesmo assim.
    reuseExistingServer: Boolean(process.env.E2E_REUSE_SERVER),
    timeout: 180_000,
    env: {
      DATABASE_URL,
      ADMIN_SESSION_SECRET: 'e2e-local-session-secret-not-for-production',
    },
  },
});
