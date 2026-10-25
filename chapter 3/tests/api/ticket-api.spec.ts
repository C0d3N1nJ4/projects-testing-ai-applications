import { test, expect } from '../../src/fixtures/test-fixtures';

test('returns a healthy service', async ({ supportDesk }) => {
  const response = await supportDesk.health();
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'UP' });
});

test('returns the requested ticket', async ({ supportDesk }) => {
  const response = await supportDesk.getTicket('T-1001');
  expect(response.status()).toBe(200);

  const ticket = await response.json();
  expect(ticket.id).toBe('T-1001');
  expect(ticket.category).toBe('NETWORK');
  expect(ticket.status).toBe('OPEN');
});

test('rejects unknown tickets', async ({ supportDesk }) => {
  const response = await supportDesk.getTicket('DOES-NOT-EXIST');
  expect(response.status()).toBe(404);
});