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
  projects: [
    { name: 'chapter5', testMatch: /.*chapter5\.spec\.ts/ },
    { name: 'chapter5-failure', testMatch: /.*learning-failure\.spec\.ts/ }
  ]
});