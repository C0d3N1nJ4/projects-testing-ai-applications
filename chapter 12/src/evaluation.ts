import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const INTENTS = ['ACCOUNT', 'HARDWARE', 'NETWORK', 'SOFTWARE'] as const;
export type Intent = (typeof INTENTS)[number];

export interface ClassificationCase {
  id: string;
  ticketId: string;
  input: string;
  expectedIntent: Intent;
  source: string;
  reviewedByRole: string;
  reviewDate: string;
  riskTags: string[];
}

export interface ClassificationDataset {
  version: string;
  cases: ClassificationCase[];
}

export interface TicketFixture {
  ticketId: string;
  status: string;
  tenant: string;
  permissions: string[];
}

export interface FixtureFile {
  version: string;
  tickets: TicketFixture[];
}

export interface EvaluationInputs {
  dataset: ClassificationDataset;
  fixtures: FixtureFile;
  datasetBytes: Buffer;
  fixtureBytes: Buffer;
}

export interface Observation {
  caseId: string;
  ticketId: string;
  input: string;
  expectedIntent: Intent;
  fixtureStatus: string;
  response: string;
  predictedIntent: Intent;
  passed: boolean;
}

export interface EvaluationScore {
  correct: number;
  total: number;
  accuracy: number;
  failingCaseIds: string[];
}

export interface EvaluationBundle {
  schemaVersion: 1;
  manifest: {
    runId: string;
    executionMode: 'recorded-simulator';
    appRevision: string;
    dirtyTreeStatus: 'not-captured';
    datasetVersion: string;
    datasetSha256: string;
    fixtureVersion: string;
    fixtureSha256: string;
    modelConfig: {
      provider: 'simulator';
      model: 'support-intent-fixture';
      revision: 'fixture-v1';
      temperature: 0;
      seed: 42;
      promptVersion: 'classify-v2';
    };
    evaluatorVersion: 'exact-classifier-v1';
    createdAt: string;
  };
  observations: Observation[];
  score: EvaluationScore;
}

export function readProjectInputs(projectRoot = resolve(__dirname, '..')): EvaluationInputs {
  const datasetBytes = readFileSync(join(projectRoot, 'datasets', 'classification.v1.json'));
  const fixtureBytes = readFileSync(join(projectRoot, 'fixtures', 'tickets.json'));
  return {
    dataset: JSON.parse(datasetBytes.toString('utf8')) as ClassificationDataset,
    fixtures: JSON.parse(fixtureBytes.toString('utf8')) as FixtureFile,
    datasetBytes,
    fixtureBytes
  };
}

export function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function predictFromResponse(response: string): Intent {
  const match = response.match(/Predicted intent:\s*(ACCOUNT|HARDWARE|NETWORK|SOFTWARE)\b/i);
  if (!match) {
    throw new Error('Recorded response does not contain a supported predicted intent.');
  }
  return match[1].toUpperCase() as Intent;
}

function summarize(observations: Observation[]): EvaluationScore {
  if (observations.length === 0) {
    throw new Error('Cannot score an evaluation with no observations.');
  }
  const correct = observations.filter(observation => observation.passed).length;
  return {
    correct,
    total: observations.length,
    accuracy: correct / observations.length,
    failingCaseIds: observations
      .filter(observation => !observation.passed)
      .map(observation => observation.caseId)
  };
}

function fixturesById(fixtures: FixtureFile): Map<string, TicketFixture> {
  const indexed = new Map<string, TicketFixture>();
  for (const fixture of fixtures.tickets) {
    if (indexed.has(fixture.ticketId)) {
      throw new Error(`Duplicate ticket fixture: ${fixture.ticketId}`);
    }
    indexed.set(fixture.ticketId, fixture);
  }
  return indexed;
}

export function createBundle(
  inputs: EvaluationInputs,
  options: { runId?: string; appRevision?: string; createdAt?: string } = {}
): EvaluationBundle {
  const tickets = fixturesById(inputs.fixtures);
  const observations = inputs.dataset.cases.map((testCase): Observation => {
    const fixture = tickets.get(testCase.ticketId);
    if (!fixture) {
      throw new Error(`Missing ticket fixture for ${testCase.id}: ${testCase.ticketId}`);
    }

    const predictedIntent = testCase.id === 'SW-004' ? 'NETWORK' : testCase.expectedIntent;
    const response = `Predicted intent: ${predictedIntent}. Ticket classified by the local simulator.`;
    return {
      caseId: testCase.id,
      ticketId: testCase.ticketId,
      input: testCase.input,
      expectedIntent: testCase.expectedIntent,
      fixtureStatus: fixture.status,
      response,
      predictedIntent: predictFromResponse(response),
      passed: predictedIntent === testCase.expectedIntent
    };
  });

  return {
    schemaVersion: 1,
    manifest: {
      runId: options.runId ?? 'example-failure-001',
      executionMode: 'recorded-simulator',
      appRevision: options.appRevision ?? 'local-simulator-v1',
      dirtyTreeStatus: 'not-captured',
      datasetVersion: inputs.dataset.version,
      datasetSha256: sha256(inputs.datasetBytes),
      fixtureVersion: inputs.fixtures.version,
      fixtureSha256: sha256(inputs.fixtureBytes),
      modelConfig: {
        provider: 'simulator',
        model: 'support-intent-fixture',
        revision: 'fixture-v1',
        temperature: 0,
        seed: 42,
        promptVersion: 'classify-v2'
      },
      evaluatorVersion: 'exact-classifier-v1',
      createdAt: options.createdAt ?? new Date().toISOString()
    },
    observations,
    score: summarize(observations)
  };
}

export function validateReplay(bundle: EvaluationBundle, inputs: EvaluationInputs): EvaluationScore {
  if (bundle.schemaVersion !== 1) {
    throw new Error(`Unsupported bundle schema version: ${bundle.schemaVersion}`);
  }
  if (bundle.manifest.datasetSha256 !== sha256(inputs.datasetBytes)) {
    throw new Error('Dataset hash mismatch; refusing to replay against changed data.');
  }
  if (bundle.manifest.fixtureSha256 !== sha256(inputs.fixtureBytes)) {
    throw new Error('Fixture hash mismatch; refusing to replay against changed state.');
  }
  if (bundle.manifest.datasetVersion !== inputs.dataset.version) {
    throw new Error('Dataset version does not match the recorded manifest.');
  }
  if (bundle.manifest.fixtureVersion !== inputs.fixtures.version) {
    throw new Error('Fixture version does not match the recorded manifest.');
  }
  if (bundle.observations.length !== inputs.dataset.cases.length) {
    throw new Error('Recorded observation count does not match the dataset.');
  }

  const tickets = fixturesById(inputs.fixtures);
  for (const [index, testCase] of inputs.dataset.cases.entries()) {
    const observation = bundle.observations[index];
    const fixture = tickets.get(testCase.ticketId);
    if (!fixture) {
      throw new Error(`Missing ticket fixture for ${testCase.id}: ${testCase.ticketId}`);
    }
    if (
      observation.caseId !== testCase.id ||
      observation.ticketId !== testCase.ticketId ||
      observation.input !== testCase.input ||
      observation.expectedIntent !== testCase.expectedIntent ||
      observation.fixtureStatus !== fixture.status
    ) {
      throw new Error(`Recorded inputs do not match dataset or fixture for ${testCase.id}.`);
    }

    const predictedIntent = predictFromResponse(observation.response);
    if (observation.predictedIntent !== predictedIntent) {
      throw new Error(`Recorded prediction does not match response for ${testCase.id}.`);
    }
    if (observation.passed !== (predictedIntent === testCase.expectedIntent)) {
      throw new Error(`Recorded pass/fail result does not match prediction for ${testCase.id}.`);
    }
  }

  const score = summarize(bundle.observations);
  if (JSON.stringify(score) !== JSON.stringify(bundle.score)) {
    throw new Error('Recorded score does not match the case-level evidence.');
  }
  return score;
}

export function findNewFailures(
  baseline: Observation[],
  candidate: Observation[]
): string[] {
  const baselineById = new Map(baseline.map(observation => [observation.caseId, observation]));
  const candidateById = new Map(candidate.map(observation => [observation.caseId, observation]));
  if (baselineById.size !== baseline.length || candidateById.size !== candidate.length) {
    throw new Error('Cannot compare runs with duplicate case IDs.');
  }
  if (
    baselineById.size !== candidateById.size ||
    [...baselineById.keys()].some(caseId => !candidateById.has(caseId))
  ) {
    throw new Error('Cannot compare runs with different case IDs.');
  }
  return [...baselineById.entries()]
    .filter(([caseId, observation]) => observation.passed && !candidateById.get(caseId)!.passed)
    .map(([caseId]) => caseId);
}
