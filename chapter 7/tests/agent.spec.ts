import { expect, test } from '@playwright/test';
import {
  AgentHarness,
  type Actor,
  type Priority,
  type Ticket
} from '../src/agent';

const operator: Actor = { id: 'user-7', role: 'OPERATOR', tenant: 'acme' };
const viewer: Actor = { id: 'user-8', role: 'VIEWER', tenant: 'acme' };
const otherTenantOperator: Actor = {
  id: 'user-9',
  role: 'OPERATOR',
  tenant: 'other'
};

function make(
  now: () => number = () => 1_000,
  tickets?: Ticket[]
): AgentHarness {
  return new AgentHarness(tickets, now);
}

function approvedChange(
  agent: AgentHarness,
  actor: Actor = operator,
  ticketId = 'T-123',
  priority: Priority = 'HIGH'
): string {
  const approval = agent.requestApproval(actor, ticketId, priority);
  agent.decide(approval.id, 'APPROVED');
  return approval.id;
}

test.describe('agent approval and execution contract', () => {
  test('reads before approval and changes state only after approval', async ({}, testInfo) => {
    const agent = make();
    const approval = agent.requestApproval(operator, 'T-123', 'HIGH');
    expect(agent.getTicket(operator, 'T-123').priority).toBe('LOW');
    expect(() => agent.update(operator, 'T-123', 'HIGH', approval.id, 'key-1'))
      .toThrow('APPROVAL_REQUIRED');

    expect(agent.getTicket(operator, 'T-123').priority).toBe('LOW');
    agent.decide(approval.id, 'APPROVED');
    expect(agent.update(operator, 'T-123', 'HIGH', approval.id, 'key-1'))
      .toMatchObject({ priority: 'HIGH', version: 2 });

    const types = agent.trace.map(event => event.type);
    expect(types.indexOf('ticket.read')).toBeLessThan(types.indexOf('approval.requested'));
    expect(types.indexOf('approval.requested')).toBeLessThan(types.indexOf('ticket.updated'));
    await testInfo.attach('agent-trace', {
      body: Buffer.from(JSON.stringify(agent.trace, null, 2)),
      contentType: 'application/json'
    });
  });

  test('denies a viewer without changing the ticket', () => {
    const agent = make();
    expect(() => agent.requestApproval(viewer, 'T-123', 'HIGH'))
      .toThrow('ACCESS_DENIED');
    expect(agent.getTicket(operator, 'T-123')).toMatchObject({
      priority: 'LOW',
      version: 1
    });
    expect(agent.trace.some(event => event.type === 'policy.denied')).toBe(true);
  });

  test('denies cross-tenant reads and writes without exposing ticket state', () => {
    const agent = make();
    expect(() => agent.getTicket(otherTenantOperator, 'T-123'))
      .toThrow('ACCESS_DENIED');
    expect(() => agent.update(
      otherTenantOperator, 'T-123', 'HIGH', 'unknown', 'foreign-key'
    )).toThrow('ACCESS_DENIED');
    expect(agent.getTicket(operator, 'T-123')).toMatchObject({
      priority: 'LOW',
      version: 1
    });
  });

  test('blocks rejected approvals without mutation', () => {
    const agent = make();
    const approval = agent.requestApproval(operator, 'T-123', 'HIGH');
    agent.decide(approval.id, 'REJECTED');
    expect(() => agent.update(operator, 'T-123', 'HIGH', approval.id, 'key-1'))
      .toThrow('APPROVAL_REQUIRED');
    expect(agent.getTicket(operator, 'T-123').priority).toBe('LOW');
  });

  test('binds approval to the exact actor, ticket, and priority', () => {
    const agent = make();
    const approvalId = approvedChange(agent);
    expect(() => agent.update(operator, 'T-123', 'MEDIUM', approvalId, 'key-1'))
      .toThrow('APPROVAL_MISMATCH');
    expect(() => agent.update(
      { ...operator, id: 'different-user' }, 'T-123', 'HIGH', approvalId, 'key-2'
    )).toThrow('APPROVAL_MISMATCH');
    expect(agent.getTicket(operator, 'T-123').priority).toBe('LOW');
  });

  test('rejects an expired approval', () => {
    let now = 1_000;
    const agent = make(() => now);
    const approvalId = approvedChange(agent);
    now += 60_000;
    expect(() => agent.update(operator, 'T-123', 'HIGH', approvalId, 'key-1'))
      .toThrow('APPROVAL_EXPIRED');
    expect(agent.getTicket(operator, 'T-123').priority).toBe('LOW');
  });

  test('rejects an approval for a stale ticket version', () => {
    const agent = make();
    const staleApprovalId = approvedChange(agent);
    const currentApprovalId = approvedChange(agent);
    agent.update(operator, 'T-123', 'HIGH', currentApprovalId, 'first-key');
    expect(() => agent.update(
      operator, 'T-123', 'HIGH', staleApprovalId, 'stale-key'
    )).toThrow('VERSION_CONFLICT');
    expect(agent.getTicket(operator, 'T-123').version).toBe(2);
  });

  test('retries a transient failure and suppresses duplicate writes', () => {
    const agent = make();
    const approvalId = approvedChange(agent);
    agent.failNextUpdate = true;
    expect(() => agent.update(
      operator, 'T-123', 'HIGH', approvalId, 'stable-key'
    )).toThrow('TRANSIENT_FAILURE');

    agent.update(operator, 'T-123', 'HIGH', approvalId, 'stable-key');
    agent.update(operator, 'T-123', 'HIGH', approvalId, 'stable-key');
    expect(agent.getTicket(operator, 'T-123').version).toBe(2);
    expect(agent.trace.filter(event => event.type === 'ticket.updated')).toHaveLength(1);
    expect(agent.trace.filter(event => event.type === 'ticket.update_replayed')).toHaveLength(1);
  });

  test('rejects reusing an idempotency key for different arguments', () => {
    const agent = make();
    const approvalId = approvedChange(agent);
    agent.update(operator, 'T-123', 'HIGH', approvalId, 'stable-key');
    expect(() => agent.update(
      operator, 'T-123', 'MEDIUM', approvalId, 'stable-key'
    )).toThrow('IDEMPOTENCY_KEY_REUSED');
    expect(agent.getTicket(operator, 'T-123').version).toBe(2);
  });
});
