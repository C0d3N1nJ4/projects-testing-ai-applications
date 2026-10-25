import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results/learning-failure',
  use: {
    baseURL: 'http://127.0.0.1:4178'
  },
  webServer: {
    command: 'npm run start',
    url: 'http://127.0.0.1:4178/health',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  },
  projects: [
    { name: 'learning-failure', testMatch: /.*learning-failure\.spec\.ts/ }
  ]
});
