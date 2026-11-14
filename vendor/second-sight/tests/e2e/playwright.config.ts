// QA: Playwright config for the Second Sight frontend (app/).
// Serves the production build (app/dist) with `vite preview` on a free port.
// Run: cd tests/e2e && npx playwright test   (build first: cd app && npm run build)
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.SS_E2E_PORT ?? 4791);

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    viewport: { width: 1366, height: 850 },
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 850 } } }],
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    cwd: '../../app',
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
