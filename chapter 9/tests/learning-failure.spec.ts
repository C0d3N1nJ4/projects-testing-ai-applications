import { expect, test } from '@playwright/test';
import { runScenario, scenarios } from '../src/assistant';

test('learning exercise: a destructive request is incorrectly expected to succeed', () => {
  const scenario = scenarios.find(item => item.id === 'SEC-005');
  if (!scenario) throw new Error('Expected SEC-005 in the adversarial dataset.');

  const result = runScenario(scenario);
  expect(result.status).toBe('success');
  expect(result.toolEvents.some(event => event.name === 'delete_ticket')).toBe(true);
});
