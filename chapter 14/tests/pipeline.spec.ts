import { expect, test } from '@playwright/test';
import { evaluate } from '../src/pipeline';

test('healthy baseline passes and records dataset provenance', async ({}, testInfo) => {
  const report = evaluate('none');
  expect(report.decision).toBe('PASS');
  expect(report.score).toEqual({ passedCases: 4, totalCases: 4, passRate: 1 });
  expect(report.dataset.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(report.executionMode).toBe('deterministic-simulator');
  await testInfo.attach('healthy-release-decision.json', {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: 'application/json'
  });
});

test('detects the prompt regression in VPN-01', () => {
  const report = evaluate('prompt-regression');
  expect(report.decision).toBe('BLOCK');
  expect(report.violations.some(item => item.caseId === 'VPN-01' && item.code === 'missing-required-facts')).toBe(true);
});

test('detects unsafe retrieval contamination in RAG-01', () => {
  const report = evaluate('retrieval-contamination');
  expect(report.decision).toBe('BLOCK');
  expect(report.violations.some(item => item.caseId === 'RAG-01' && item.code === 'prohibited-advice')).toBe(true);
});

test('blocks a ticket update executed without prior approval', () => {
  const report = evaluate('approval-bypass');
  const agentCase = report.results.find(item => item.caseId === 'AGENT-01');
  expect(report.decision).toBe('BLOCK');
  expect(agentCase?.trace).not.toContain('approval.verified');
  expect(report.violations.some(item => item.caseId === 'AGENT-01' && item.code === 'approval-bypass')).toBe(true);
  expect(agentCase?.ticketStateAfter).toBe('PRIORITY_UPDATED');
});

test('blocks an MFA latency SLO breach in MFA-01', () => {
  const report = evaluate('latency-regression');
  expect(report.decision).toBe('BLOCK');
  expect(report.violations.some(item => item.caseId === 'MFA-01' && item.code === 'latency-slo')).toBe(true);
});

test('blocks the combined defect campaign with case-level evidence', () => {
  const report = evaluate('all');
  expect(report.decision).toBe('BLOCK');
  expect(report.results.filter(item => !item.passed).map(item => item.caseId).sort()).toEqual([
    'AGENT-01',
    'MFA-01',
    'RAG-01',
    'VPN-01'
  ]);
  expect(report.violations.map(item => item.code)).toEqual([
    'missing-required-facts',
    'missing-required-facts',
    'prohibited-advice',
    'approval-bypass',
    'latency-slo'
  ]);
});

test('requires approval to appear before the ticket-update tool call', () => {
  const report = evaluate('none');
  const agentCase = report.results.find(item => item.caseId === 'AGENT-01');
  expect(agentCase).toBeDefined();
  expect(agentCase!.trace.indexOf('approval.verified'))
    .toBeLessThan(agentCase!.trace.indexOf('tool.update_ticket'));
});

test('learning: incorrectly expects the combined defect campaign to pass', { tag: '@learning' }, () => {
  expect(evaluate('all').decision).toBe('PASS');
});
