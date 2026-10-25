import { test, expect } from '../../src/fixtures/test-fixtures';

test('demonstrates a deliberately incorrect expectation', async ({ supportDesk }) => {
  const response = await supportDesk.getTicket('T-1001');
  expect(response.status()).toBe(200);

  const ticket = await response.json();
  expect(ticket.category).toBe('HARDWARE');
});