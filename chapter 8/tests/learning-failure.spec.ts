import { expect, test } from '@playwright/test';

test.skip('LEARNING ONLY: illustrates an incorrect release expectation', async ({ request }) => {
  const response = await request.post('/api/tickets', {
    data: { description: 'VPN fails' }
  });
  const ticket = await response.json();

  expect(ticket.status).toBe('RESOLVED');
});
