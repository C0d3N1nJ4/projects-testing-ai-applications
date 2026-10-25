import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  outputDir: 'test-results',
  use: {
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'mock' },
    { name: 'local-ai' },
    { name: 'regression-demo' }
  ]
});