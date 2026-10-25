import { expect, test } from '@playwright/test';
import {
  configurations,
  measure,
  percentile,
  scenarios,
  summarize,
  type Measurement
} from '../src/measure';
import { performance } from 'node:perf_hooks';

test('compares quality, performance, usage, cost, and traces on the same dataset', async ({}, testInfo) => {
  const results: Record<'fast' | 'careful', Measurement[]> = {
    fast: [],
    careful: []
  };
  const summaries = {} as Record<'fast' | 'careful', ReturnType<typeof summarize>>;

  for (const configId of ['fast', 'careful'] as const) {
    const started = performance.now();
    for (const scenario of scenarios) {
      results[configId].push(await measure(configurations[configId], scenario));
    }
    const elapsed = performance.now() - started;
    summaries[configId] = summarize(results[configId], elapsed);
  }

  expect(results.fast.map(result => result.caseId))
    .toEqual(scenarios.map(scenario => scenario.id));
  expect(results.careful.map(result => result.caseId))
    .toEqual(scenarios.map(scenario => scenario.id));
  expect(summaries.fast.sampleCount).toBe(scenarios.length);
  expect(summaries.careful.sampleCount).toBe(scenarios.length);
  expect(summaries.fast.averageQualityCoverage).toBeLessThan(1);
  expect(summaries.careful.averageQualityCoverage).toBe(1);
  expect(summaries.fast.totalEstimatedCost).toBeLessThan(summaries.careful.totalEstimatedCost);
  expect(summaries.fast.totalInputTokens).toBeLessThan(summaries.careful.totalInputTokens);
  expect(summaries.fast.totalOutputTokens).toBeLessThan(summaries.careful.totalOutputTokens);

  for (const result of [...results.fast, ...results.careful]) {
    expect(result.endToEndLatencyMs).toBeGreaterThanOrEqual(result.timeToFirstChunkMs);
    expect(result.timeToFirstChunkMs).toBeGreaterThanOrEqual(0);
    expect(result.modelDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.estimatedCost).toBeGreaterThan(0);
    expect(result.spans.map(span => span.name)).toEqual([
      'knowledge.retrieve',
      'model.generate'
    ]);
    expect(result.spans.every(span => span.durationMs >= 0 && span.status === 'ok')).toBe(true);
    expect(result.spans.every(span => !('prompt' in span.attributes))).toBe(true);
  }

  expect(percentile([100, 105, 115, 130, 900], 0.5)).toBe(115);
  expect(percentile([100, 105, 115, 130, 900], 0.95)).toBe(900);

  await testInfo.attach('quality-performance-evidence.json', {
    body: Buffer.from(JSON.stringify({
      runType: 'synthetic deterministic test double',
      percentileMethod: 'nearest-rank',
      dataset: scenarios.map(scenario => scenario.id),
      configs: summaries,
      results
    }, null, 2)),
    contentType: 'application/json'
  });
});

test('uses nearest-rank percentiles and rejects invalid sample inputs', () => {
  expect(percentile([4, 1, 3, 2], 0.5)).toBe(2);
  expect(percentile([4, 1, 3, 2], 0.95)).toBe(4);
  expect(() => percentile([], 0.5)).toThrow(RangeError);
  expect(() => percentile([1], 0)).toThrow(RangeError);
});
