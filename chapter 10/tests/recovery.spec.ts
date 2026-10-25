import { expect, test } from '@playwright/test';
import {
  DependencyError,
  generateReliably,
  parseResolution,
  ScriptedProvider,
  TicketStore,
  type RetryPolicy
} from '../src/reliability';

const policy: RetryPolicy = {
  maxAttempts: 3,
  timeoutMs: 100,
  baseDelayMs: 10,
  maxDelayMs: 100
};

async function attachEvidence(
  testInfo: { attach: (name: string, options: { body: Buffer; contentType: string }) => Promise<void> },
  evidence: unknown
): Promise<void> {
  await testInfo.attach('reliability-evidence', {
    body: Buffer.from(JSON.stringify(evidence, null, 2)),
    contentType: 'application/json'
  });
}

test('retries a transient model outage with bounded deterministic backoff', async ({}, testInfo) => {
  const provider = new ScriptedProvider([
    { type: 'failure', kind: 'unavailable' },
    { type: 'success', value: 'Open the VPN settings.' }
  ]);
  const delays: number[] = [];
  const result = await generateReliably(
    provider,
    'VPN help',
    policy,
    async milliseconds => { delays.push(milliseconds); }
  );

  expect(result).toMatchObject({ status: 'ok', attempts: 2, text: 'Open the VPN settings.' });
  expect(provider.calls).toBe(2);
  expect(delays).toEqual([10]);
  await attachEvidence(testInfo, { result, calls: provider.calls, delays });
});

test('honors a rate-limit retry hint', async ({}, testInfo) => {
  const provider = new ScriptedProvider([
    { type: 'failure', kind: 'rate_limited', retryAfterMs: 250 },
    { type: 'success', value: 'ok' }
  ]);
  const delays: number[] = [];
  const result = await generateReliably(
    provider,
    'question',
    policy,
    async milliseconds => { delays.push(milliseconds); }
  );

  expect(result.status).toBe('ok');
  expect(delays).toEqual([250]);
  await attachEvidence(testInfo, { result, delays });
});

test('does not retry malformed provider output or pass it to a tool', async ({}, testInfo) => {
  const provider = new ScriptedProvider([
    { type: 'success', value: '{ ticketId: INC-101, action: RESOLVE }' }
  ]);
  const store = new TicketStore();
  const generated = await generateReliably(provider, 'resolve ticket', policy);

  expect(generated.status).toBe('ok');
  if (generated.status !== 'ok') throw new Error('Expected a provider response.');
  expect(() => parseResolution(generated.text)).toThrow(DependencyError);
  expect(() => parseResolution(generated.text)).toThrow('not valid JSON');
  expect(provider.calls).toBe(1);
  expect(store.effectiveUpdates).toBe(0);
  expect(store.current).toMatchObject({ status: 'OPEN', version: 1 });
  await attachEvidence(testInfo, {
    generated,
    parsed: false,
    providerCalls: provider.calls,
    ticket: store.current
  });
});

test('rejects valid JSON with an invalid action before tool execution', async ({}, testInfo) => {
  const store = new TicketStore();
  expect(() => parseResolution(
    '{"ticketId":"INC-101","action":"DELETE","approvalId":"APR-402"}'
  )).toThrow('resolution contract');
  expect(store.effectiveUpdates).toBe(0);
  expect(store.current.status).toBe('OPEN');
  await attachEvidence(testInfo, {
    parsed: false,
    effectiveUpdates: store.effectiveUpdates,
    ticket: store.current
  });
});

test('does not retry a context-limit failure', async ({}, testInfo) => {
  const provider = new ScriptedProvider([
    { type: 'failure', kind: 'context_limit' },
    { type: 'success', value: 'must not be consumed' }
  ]);
  const result = await generateReliably(provider, 'long prompt', policy);

  expect(result).toMatchObject({ status: 'failed', reason: 'context_limit', attempts: 1 });
  expect(provider.calls).toBe(1);
  await attachEvidence(testInfo, { result, calls: provider.calls });
});

test('uses a limited fallback after bounded primary-provider failures', async ({}, testInfo) => {
  const provider = new ScriptedProvider([
    { type: 'failure', kind: 'unavailable' },
    { type: 'failure', kind: 'unavailable' },
    { type: 'failure', kind: 'unavailable' }
  ]);
  const delays: number[] = [];
  const result = await generateReliably(
    provider,
    'VPN help',
    policy,
    async milliseconds => { delays.push(milliseconds); },
    async () => 'Contact the support desk for assistance.'
  );

  expect(result).toMatchObject({
    status: 'fallback',
    attempts: 3,
    text: 'Contact the support desk for assistance.'
  });
  expect(provider.calls).toBe(3);
  expect(delays).toEqual([10, 20]);
  await attachEvidence(testInfo, { result, calls: provider.calls, delays });
});

test('bounds a provider call that never completes', async ({}, testInfo) => {
  const provider = new ScriptedProvider([{ type: 'hang' }]);
  const result = await generateReliably(
    provider,
    'slow prompt',
    { ...policy, maxAttempts: 1, timeoutMs: 10 }
  );

  expect(result).toMatchObject({ status: 'failed', reason: 'timeout', attempts: 1 });
  expect(result.trace.some(event => event.event === 'timeout')).toBe(true);
  expect(provider.calls).toBe(1);
  await attachEvidence(testInfo, { result, calls: provider.calls });
});

test('replays a committed update after lost acknowledgement without a duplicate write', async ({}, testInfo) => {
  const store = new TicketStore();
  const approval = { ticketId: 'INC-101', authorized: true, approved: true };
  expect(() => store.update(approval, 'operation-42', true))
    .toThrow('acknowledgement was lost');
  expect(store.current).toMatchObject({ status: 'RESOLVED', version: 2 });

  const reconciled = store.update(approval, 'operation-42');
  expect(reconciled).toMatchObject({ status: 'RESOLVED', version: 2 });
  expect(store.effectiveUpdates).toBe(1);
  expect(store.trace.map(event => event.event)).toEqual([
    'ticket.updated',
    'ticket.update_replayed'
  ]);
  await attachEvidence(testInfo, {
    approval,
    operationId: 'operation-42',
    ticket: reconciled,
    trace: store.trace,
    effectiveUpdates: store.effectiveUpdates
  });
});

test('denies an update without approval and preserves ticket state', async ({}, testInfo) => {
  const store = new TicketStore();
  expect(() => store.update(
    { ticketId: 'INC-101', authorized: true, approved: false },
    'operation-43'
  )).toThrow('A valid authorized approval is required.');
  expect(store.current).toMatchObject({ status: 'OPEN', version: 1 });
  expect(store.effectiveUpdates).toBe(0);
  await attachEvidence(testInfo, { ticket: store.current, trace: store.trace });
});

test('rejects reusing an operation ID with different approval arguments', () => {
  const store = new TicketStore();
  store.update(
    { ticketId: 'INC-101', authorized: true, approved: true },
    'operation-44'
  );
  expect(() => store.update(
    { ticketId: 'INC-101', authorized: false, approved: true },
    'operation-44'
  )).toThrow('OPERATION_ID_REUSED');
  expect(store.effectiveUpdates).toBe(1);
});
