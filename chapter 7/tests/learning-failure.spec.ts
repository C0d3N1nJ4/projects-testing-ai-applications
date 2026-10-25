import { expect, test } from '@playwright/test';
import { AgentHarness, type Actor } from '../src/agent';

test('learning exercise: an update without approval is expected to be rejected', () => {
  const agent = new AgentHarness();
  const operator: Actor = { id: 'user-7', role: 'OPERATOR', tenant: 'acme' };

  expect(() => agent.update(operator, 'T-123', 'HIGH', 'missing-approval', 'key-1'))
    .not.toThrow();
});
