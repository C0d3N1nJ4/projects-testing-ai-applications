import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { qualityGate, type PairedCase } from './gate';

interface QualityDataset {
  datasetId: string;
  version: string;
  rubricVersion: string;
  scoreRange: [number, number];
  cases: PairedCase[];
}

function profileFromArgs(): 'baseline' | 'regression' {
  const index = process.argv.indexOf('--profile');
  const profile = index < 0 ? 'baseline' : process.argv[index + 1];
  if (profile !== 'baseline' && profile !== 'regression') {
    throw new Error('Usage: gate-cli.ts --profile <baseline|regression>');
  }
  return profile;
}

function markdownSummary(result: ReturnType<typeof qualityGate>, dataset: QualityDataset, profile: string): string {
  return [
    '## Chapter 13 AI quality gate',
    '',
    `- Decision: **${result.status.toUpperCase()}**`,
    `- Profile: \`${profile}\``,
    `- Dataset: \`${dataset.datasetId}@${dataset.version}\``,
    `- Rubric: \`${dataset.rubricVersion}\``,
    `- Paired cases: ${result.cases}`,
    `- Candidate mean: ${result.meanCandidate.toFixed(3)}`,
    `- Mean paired change: ${result.meanDelta.toFixed(3)}`,
    `- 95% paired-bootstrap interval: [${result.ci95.lower.toFixed(3)}, ${result.ci95.upper.toFixed(3)}]`,
    `- Reason: ${result.reason}`,
    ''
  ].join('\n');
}

function main(): void {
  const profile = profileFromArgs();
  const root = resolve(__dirname, '..');
  const datasetPath = resolve(root, 'datasets/paired-quality.json');
  const rawDataset = readFileSync(datasetPath);
  const dataset = JSON.parse(rawDataset.toString('utf8')) as QualityDataset;
  if (dataset.scoreRange[0] !== 0 || dataset.scoreRange[1] !== 1) {
    throw new Error('This gate expects dataset scores in the range [0, 1].');
  }

  const cases = profile === 'baseline'
    ? dataset.cases.map(item => ({ ...item, candidate: item.baseline }))
    : dataset.cases;
  const result = qualityGate(cases);
  const evidence = {
    executionMode: 'synthetic-paired-scores',
    profile,
    generatedAt: new Date().toISOString(),
    dataset: {
      id: dataset.datasetId,
      version: dataset.version,
      sha256: createHash('sha256').update(rawDataset).digest('hex')
    },
    rubricVersion: dataset.rubricVersion,
    policy: {
      minimumCases: 15,
      candidateFloor: 0.8,
      regressionMargin: 0.05,
      bootstrapResamples: 4000,
      seed: 42,
      intervalMethod: 'paired bootstrap with nearest-rank 95% interval'
    },
    result,
    caseResults: cases.map(item => ({
      caseId: item.caseId,
      baseline: item.baseline,
      candidate: item.candidate,
      difference: item.candidate - item.baseline
    }))
  };
  const artifactPath = resolve(root, 'artifacts/quality-gate.json');
  mkdirSync(dirname(artifactPath), { recursive: true });
  writeFileSync(artifactPath, `${JSON.stringify(evidence, null, 2)}\n`);

  const summary = markdownSummary(result, dataset, profile);
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) appendFileSync(summaryPath, summary);
  console.log(summary.trimEnd());

  if (result.status === 'block' || result.status === 'inconclusive') {
    const message = `${result.status.toUpperCase()}: ${result.reason} Mean change ${result.meanDelta.toFixed(3)}; 95% interval [${result.ci95.lower.toFixed(3)}, ${result.ci95.upper.toFixed(3)}].`;
    console.log(`::error title=AI quality gate::${message}`);
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Quality gate failed: ${message}`);
  console.log(`::error title=AI quality gate configuration::${message}`);
  process.exitCode = 1;
}
