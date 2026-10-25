import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results/learning-failure',
  projects: [
    { name: 'learning-failure', testMatch: /.*learning-failure\.spec\.ts/ }
  ]
});
