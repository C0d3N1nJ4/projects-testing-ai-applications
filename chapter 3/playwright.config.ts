import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'reports/junit.xml' }],
    ['json', { outputFile: 'reports/results.json' }]
  ],
  outputDir: 'test-results',
  use: {
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'api-and-model', testIgnore: /.*intentional-failure\.spec\.ts/ },
    { name: 'learning-failure', testMatch: /.*intentional-failure\.spec\.ts/ }
  ]
});