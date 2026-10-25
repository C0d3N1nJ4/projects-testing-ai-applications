import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import casesJson from '../datasets/performance-cases.json';

export interface PerformanceCase {
  id: string;
  prompt: string;
  requiredFacts: string[];
  referenceAnswer: string;
}

export interface ModelConfig {
  id: 'fast' | 'careful';
  retrievalDelayMs: number;
  firstChunkDelayMs: number;
  completionDelayMs: number;
  inputRatePerMillion: number;
  outputRatePerMillion: number;
  inputTokens: number;
  outputTokens: number;
}

export interface Span {
  name: string;
  startedMs: number;
  durationMs: number;
  status: 'ok';
  attributes: Record<string, string | number>;
}

export interface Measurement {
  caseId: string;
  configId: ModelConfig['id'];
  traceId: string;
  endToEndLatencyMs: number;
  timeToFirstChunkMs: number;
  modelDurationMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  quality: {
    passedFacts: number;
    requiredFacts: number;
    coverage: number;
    missingFacts: string[];
  };
  response: string;
  spans: Span[];
}

export const scenarios = casesJson as PerformanceCase[];

export const configurations: Record<'fast' | 'careful', ModelConfig> = {
  fast: {
    id: 'fast',
    retrievalDelayMs: 3,
    firstChunkDelayMs: 3,
    completionDelayMs: 5,
    inputRatePerMillion: 0.1,
    outputRatePerMillion: 0.4,
    inputTokens: 450,
    outputTokens: 45
  },
  careful: {
    id: 'careful',
    retrievalDelayMs: 10,
    firstChunkDelayMs: 12,
    completionDelayMs: 20,
    inputRatePerMillion: 0.5,
    outputRatePerMillion: 2,
    inputTokens: 850,
    outputTokens: 95
  }
};

const delay = (milliseconds: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

function responseFor(config: ModelConfig, scenario: PerformanceCase): string {
  if (config.id === 'careful') return scenario.referenceAnswer;
  if (scenario.id === 'VPN-01') {
    return 'Open VPN settings, select the corporate profile, and attempt to reconnect.';
  }
  return scenario.referenceAnswer;
}

function estimateCost(config: ModelConfig): number {
  return (
    config.inputTokens / 1_000_000 * config.inputRatePerMillion +
    config.outputTokens / 1_000_000 * config.outputRatePerMillion
  );
}

export async function measure(
  config: ModelConfig,
  scenario: PerformanceCase
): Promise<Measurement> {
  const traceId = randomUUID();
  const requestStarted = performance.now();
  const spans: Span[] = [];
  const retrievalStarted = performance.now();
  await delay(config.retrievalDelayMs);
  spans.push({
    name: 'knowledge.retrieve',
    startedMs: retrievalStarted - requestStarted,
    durationMs: performance.now() - retrievalStarted,
    status: 'ok',
    attributes: { 'dataset.case_id': scenario.id }
  });

  const generationStarted = performance.now();
  await delay(config.firstChunkDelayMs);
  const firstChunkAt = performance.now();
  const response = responseFor(config, scenario);
  await delay(config.completionDelayMs);
  const generationEnded = performance.now();
  spans.push({
    name: 'model.generate',
    startedMs: generationStarted - requestStarted,
    durationMs: generationEnded - generationStarted,
    status: 'ok',
    attributes: {
      'dataset.case_id': scenario.id,
      'model.config': config.id,
      'usage.input_tokens': config.inputTokens,
      'usage.output_tokens': config.outputTokens
    }
  });

  const normalizedResponse = normalizeForFactCheck(response);
  const missingFacts = scenario.requiredFacts.filter(
    fact => !normalizedResponse.includes(normalizeForFactCheck(fact))
  );
  const requiredFacts = scenario.requiredFacts.length;
  const passedFacts = requiredFacts - missingFacts.length;

  return {
    caseId: scenario.id,
    configId: config.id,
    traceId,
    endToEndLatencyMs: performance.now() - requestStarted,
    timeToFirstChunkMs: firstChunkAt - requestStarted,
    modelDurationMs: generationEnded - generationStarted,
    inputTokens: config.inputTokens,
    outputTokens: config.outputTokens,
    estimatedCost: estimateCost(config),
    quality: {
      passedFacts,
      requiredFacts,
      coverage: requiredFacts === 0 ? 1 : passedFacts / requiredFacts,
      missingFacts
    },
    response,
    spans
  };
}

function normalizeForFactCheck(value: string): string {
  return value.toLowerCase().replace(/-/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function percentile(values: number[], percentileValue: number): number {
  if (
    values.length === 0 ||
    percentileValue <= 0 ||
    percentileValue > 1
  ) {
    throw new RangeError('Percentile requires samples and a value in (0, 1].');
  }
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(percentileValue * sorted.length) - 1];
}

export interface Summary {
  sampleCount: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p50FirstChunkMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalEstimatedCost: number;
  averageQualityCoverage: number;
  requestsPerSecond: number;
  elapsedWallClockMs: number;
}

export function summarize(results: Measurement[], elapsedWallClockMs: number): Summary {
  if (results.length === 0 || elapsedWallClockMs <= 0) {
    throw new RangeError('Summary requires results and positive elapsed wall-clock time.');
  }
  return {
    sampleCount: results.length,
    p50LatencyMs: percentile(results.map(result => result.endToEndLatencyMs), 0.5),
    p95LatencyMs: percentile(results.map(result => result.endToEndLatencyMs), 0.95),
    p50FirstChunkMs: percentile(results.map(result => result.timeToFirstChunkMs), 0.5),
    totalInputTokens: results.reduce((sum, result) => sum + result.inputTokens, 0),
    totalOutputTokens: results.reduce((sum, result) => sum + result.outputTokens, 0),
    totalEstimatedCost: results.reduce((sum, result) => sum + result.estimatedCost, 0),
    averageQualityCoverage:
      results.reduce((sum, result) => sum + result.quality.coverage, 0) / results.length,
    requestsPerSecond: results.length / (elapsedWallClockMs / 1000),
    elapsedWallClockMs
  };
}
