import { expect, test } from '@playwright/test';
import { TicketStore } from '../src/reliability';

test('learning exercise: incorrectly expects a replay to count as a second update', () => {
  const store = new TicketStore();
  const approval = { ticketId: 'INC-101', authorized: true, approved: true };

  store.update(approval, 'operation-42');
  store.update(approval, 'operation-42');

  expect(store.effectiveUpdates).toBe(2);
});
