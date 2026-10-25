export interface PairedCase {
  caseId: string;
  baseline: number;
  candidate: number;
}

export interface QualityGateOptions {
  minimumCases?: number;
  candidateFloor?: number;
  regressionMargin?: number;
  bootstrapResamples?: number;
  seed?: number;
}

export interface QualityGateResult {
  status: 'pass' | 'block' | 'inconclusive';
  meanDelta: number;
  ci95: { lower: number; upper: number };
  meanCandidate: number;
  cases: number;
  reason: string;
}

const defaults = {
  minimumCases: 15,
  candidateFloor: 0.8,
  regressionMargin: 0.05,
  bootstrapResamples: 4000,
  seed: 42
};

function validateOptions(options: Required<QualityGateOptions>): void {
  if (!Number.isInteger(options.minimumCases) || options.minimumCases < 1) {
    throw new RangeError('minimumCases must be a positive integer.');
  }
  if (!Number.isFinite(options.candidateFloor) || options.candidateFloor < 0 || options.candidateFloor > 1) {
    throw new RangeError('candidateFloor must be between 0 and 1.');
  }
  if (!Number.isFinite(options.regressionMargin) || options.regressionMargin < 0 || options.regressionMargin > 1) {
    throw new RangeError('regressionMargin must be between 0 and 1.');
  }
  if (!Number.isInteger(options.bootstrapResamples) || options.bootstrapResamples < 100) {
    throw new RangeError('bootstrapResamples must be an integer of at least 100.');
  }
  if (!Number.isInteger(options.seed)) {
    throw new RangeError('seed must be an integer.');
  }
}

function validateCases(cases: PairedCase[]): void {
  if (cases.length === 0) {
    throw new Error('The quality gate requires at least one paired case.');
  }
  const identifiers = new Set<string>();
  for (const item of cases) {
    if (!item.caseId.trim() || identifiers.has(item.caseId)) {
      throw new Error(`Missing or duplicate case ID: ${item.caseId}`);
    }
    identifiers.add(item.caseId);
    for (const [label, score] of [['baseline', item.baseline], ['candidate', item.candidate]] as const) {
      if (!Number.isFinite(score) || score < 0 || score > 1) {
        throw new RangeError(`${label} score for ${item.caseId} must be between 0 and 1.`);
      }
    }
  }
}

function randomGenerator(seed: number): () => number {
  let state = seed >>> 0;
  if (state === 0) state = 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

function nearestRank(sorted: number[], probability: number): number {
  return sorted[Math.max(0, Math.ceil(probability * sorted.length) - 1)];
}

function pairedBootstrapInterval(
  differences: number[],
  resamples: number,
  seed: number
): { lower: number; upper: number } {
  const random = randomGenerator(seed);
  const means = new Array<number>(resamples);
  for (let sample = 0; sample < resamples; sample++) {
    let total = 0;
    for (let item = 0; item < differences.length; item++) {
      total += differences[Math.floor(random() * differences.length)];
    }
    means[sample] = total / differences.length;
  }
  means.sort((left, right) => left - right);
  return {
    lower: nearestRank(means, 0.025),
    upper: nearestRank(means, 0.975)
  };
}

export function qualityGate(
  cases: PairedCase[],
  overrides: QualityGateOptions = {}
): QualityGateResult {
  validateCases(cases);
  const options = { ...defaults, ...overrides };
  validateOptions(options);

  const differences = cases.map(item => item.candidate - item.baseline);
  const meanDelta = differences.reduce((sum, value) => sum + value, 0) / cases.length;
  const meanCandidate = cases.reduce((sum, item) => sum + item.candidate, 0) / cases.length;
  const ci95 = pairedBootstrapInterval(differences, options.bootstrapResamples, options.seed);

  if (meanCandidate < options.candidateFloor) {
    return {
      status: 'block', meanDelta, ci95, meanCandidate, cases: cases.length,
      reason: `Candidate mean ${meanCandidate.toFixed(3)} is below the quality floor ${options.candidateFloor.toFixed(2)}.`
    };
  }
  if (cases.length < options.minimumCases) {
    return {
      status: 'inconclusive', meanDelta, ci95, meanCandidate, cases: cases.length,
      reason: `Only ${cases.length} paired cases are available; at least ${options.minimumCases} are required.`
    };
  }
  if (ci95.upper < -options.regressionMargin) {
    return {
      status: 'block', meanDelta, ci95, meanCandidate, cases: cases.length,
      reason: `The full 95% paired-bootstrap interval is below the unacceptable regression margin of -${options.regressionMargin.toFixed(2)}.`
    };
  }
  if (ci95.lower < -options.regressionMargin) {
    return {
      status: 'inconclusive', meanDelta, ci95, meanCandidate, cases: cases.length,
      reason: `The 95% paired-bootstrap interval overlaps the unacceptable regression region below -${options.regressionMargin.toFixed(2)}.`
    };
  }
  return {
    status: 'pass', meanDelta, ci95, meanCandidate, cases: cases.length,
    reason: 'The candidate meets the absolute quality floor and no unacceptable regression is established.'
  };
}
