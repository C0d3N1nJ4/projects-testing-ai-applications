import { expect, test } from '@playwright/test';
import dataset from '../datasets/paired-quality.json';
import { qualityGate, type PairedCase } from '../src/gate';

const cases = dataset.cases as PairedCase[];
const baseline = cases.map(item => ({ ...item, candidate: item.baseline }));

test('passes when baseline and candidate scores match', async ({}, testInfo) => {
  const result = qualityGate(baseline);
  expect(result.status).toBe('pass');
  expect(result.meanDelta).toBe(0);
  expect(result.cases).toBe(20);
  await testInfo.attach('baseline-quality-gate.json', {
    body: Buffer.from(JSON.stringify(result, null, 2)),
    contentType: 'application/json'
  });
});

test('blocks an established regression on the paired cases', () => {
  const result = qualityGate(cases);
  expect(result.status).toBe('block');
  expect(result.meanCandidate).toBeGreaterThanOrEqual(0.8);
  expect(result.ci95.upper).toBeLessThan(-0.05);
});

test('marks an undersized evaluation inconclusive', () => {
  const result = qualityGate(baseline.slice(0, 5));
  expect(result.status).toBe('inconclusive');
  expect(result.reason).toMatch(/at least 15 are required/);
});

test('blocks a candidate below the absolute quality floor', () => {
  const lowQuality = baseline.map(item => ({ ...item, candidate: 0.79 }));
  const result = qualityGate(lowQuality);
  expect(result.status).toBe('block');
  expect(result.reason).toMatch(/below the quality floor/);
});

test('rejects duplicate IDs and scores outside the rubric range', () => {
  expect(() => qualityGate([cases[0], cases[0]])).toThrow(/duplicate case ID/);
  expect(() => qualityGate([{ ...cases[0], candidate: 1.1 }])).toThrow(/between 0 and 1/);
});

test('learning: deliberately expects the degraded candidate to pass', { tag: '@learning' }, () => {
  expect(qualityGate(cases).status).toBe('pass');
});
