import { expect, test } from '@playwright/test';

type Ticket = {
  id: string;
  description: string;
  status: 'OPEN' | 'RESOLVED';
  version: number;
};
type Proposal = {
  id: string;
  ticketId: string;
  state: 'PENDING' | 'APPROVED' | 'EXECUTED';
};
type AuditEvent = {
  type: string;
  ticketId: string;
  proposalId?: string;
};

test.beforeEach(async ({ request }) => {
  const response = await request.post('/api/reset');
  expect(response.ok()).toBe(true);
});

test('resolves a ticket end to end after approval', async ({ page, request }, testInfo) => {
  await page.goto('/');
  await page.getByLabel('Describe your issue')
    .fill('My corporate VPN disconnects every hour');
  await page.getByRole('button', { name: 'Create ticket' }).click();

  const ticketLabel = await page.getByText(/^Ticket: T-/).textContent();
  if (!ticketLabel) throw new Error('The UI did not display the created ticket ID.');
  const ticketId = ticketLabel.replace('Ticket: ', '');
  await expect(page.locator('#state')).toHaveText('Status: OPEN');

  const createdResponse = await request.get(`/api/tickets/${ticketId}`);
  expect(createdResponse.status()).toBe(200);
  const createdTicket = (await createdResponse.json()) as Ticket;
  expect(createdTicket).toMatchObject({ id: ticketId, status: 'OPEN', version: 1 });

  await page.getByRole('button', { name: 'Get AI guidance' }).click();
  await expect(page.locator('#guidance')).toContainText('human approval');

  await page.getByRole('button', { name: 'Request resolution approval' }).click();
  await expect(page.locator('#approval')).toHaveText('Approval pending');
  const pendingResponse = await request.get(`/api/tickets/${ticketId}`);
  const pendingTicket = (await pendingResponse.json()) as Ticket;
  expect(pendingTicket).toMatchObject({ status: 'OPEN', version: 1 });

  const auditBeforeApproval = (await (await request.get('/api/audit')).json()) as AuditEvent[];
  const journeyEvents = auditBeforeApproval.filter(event => event.ticketId === ticketId);
  const proposalEvent = journeyEvents.find(event => event.type === 'approval.requested');
  if (!proposalEvent?.proposalId) throw new Error('No correlated approval proposal was recorded.');

  const deniedApproval = await request.post(
    `/api/proposals/${proposalEvent.proposalId}/approve`,
    { headers: { 'x-user-role': 'reader' } }
  );
  expect(deniedApproval.status()).toBe(403);

  await page.getByRole('button', { name: 'Approve resolution' }).click();
  await expect(page.locator('#approval')).toHaveText('Approval granted');
  await page.getByRole('button', { name: 'Execute approved resolution' }).click();
  await expect(page.locator('#state')).toHaveText('Status: RESOLVED');

  const finalResponse = await request.get(`/api/tickets/${ticketId}`);
  expect(finalResponse.status()).toBe(200);
  const finalTicket = (await finalResponse.json()) as Ticket;
  expect(finalTicket).toMatchObject({ status: 'RESOLVED', version: 2 });

  const executeResponse = await request.post(
    `/api/proposals/${proposalEvent.proposalId}/execute`
  );
  expect(executeResponse.status()).toBe(200);
  const replayedTicket = (await executeResponse.json()) as Ticket;
  expect(replayedTicket).toMatchObject({ status: 'RESOLVED', version: 2 });

  const audit = (await (await request.get('/api/audit')).json()) as AuditEvent[];
  const specific = audit.filter(event => event.ticketId === ticketId);
  const names = specific.map(event => event.type);
  expect(names.indexOf('tool.ticket.get')).toBeLessThan(names.indexOf('approval.requested'));
  expect(names.indexOf('approval.requested')).toBeLessThan(names.indexOf('approval.granted'));
  expect(names.indexOf('approval.granted')).toBeLessThan(names.indexOf('tool.ticket.update'));
  expect(names.filter(name => name === 'tool.ticket.update')).toHaveLength(1);

  await testInfo.attach('journey-evidence', {
    body: Buffer.from(JSON.stringify({
      ticketId,
      createdTicket,
      pendingTicket,
      finalTicket,
      audit: specific
    }, null, 2)),
    contentType: 'application/json'
  });
});

test('rejects execution before approval without changing ticket state', async ({ request }) => {
  const ticketResponse = await request.post('/api/tickets', {
    data: { description: 'VPN disconnects' }
  });
  const ticket = (await ticketResponse.json()) as Ticket;
  const proposalResponse = await request.post(`/api/tickets/${ticket.id}/proposals`);
  const proposal = (await proposalResponse.json()) as Proposal;

  const denied = await request.post(`/api/proposals/${proposal.id}/execute`);
  expect(denied.status()).toBe(403);

  const stored = (await (await request.get(`/api/tickets/${ticket.id}`)).json()) as Ticket;
  expect(stored).toMatchObject({ status: 'OPEN', version: 1 });
});

test('rejects an unauthorized approval request', async ({ request }) => {
  const ticketResponse = await request.post('/api/tickets', {
    data: { description: 'VPN disconnects' }
  });
  const ticket = (await ticketResponse.json()) as Ticket;
  const proposalResponse = await request.post(`/api/tickets/${ticket.id}/proposals`);
  const proposal = (await proposalResponse.json()) as Proposal;

  const denied = await request.post(`/api/proposals/${proposal.id}/approve`, {
    headers: { 'x-user-role': 'reader' }
  });
  expect(denied.status()).toBe(403);

  const stored = (await (await request.get(`/api/tickets/${ticket.id}`)).json()) as Ticket;
  expect(stored).toMatchObject({ status: 'OPEN', version: 1 });
});
