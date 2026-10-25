import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import {
  createBundle,
  findNewFailures,
  readProjectInputs,
  validateReplay,
  type EvaluationBundle
} from '../src/evaluation';

const projectRoot = resolve(__dirname, '..');
const inputs = readProjectInputs(projectRoot);
const bundle = createBundle(inputs, { createdAt: '2026-10-25T00:00:00.000Z' });

test('replays recorded evidence and attaches the failure bundle', async ({}, testInfo) => {
  const score = validateReplay(bundle, inputs);

  expect(score).toEqual({
    correct: 3,
    total: 4,
    accuracy: 0.75,
    failingCaseIds: ['SW-004']
  });
  expect(bundle.manifest.modelConfig).toMatchObject({
    provider: 'simulator',
    model: 'support-intent-fixture',
    temperature: 0,
    seed: 42
  });
  await testInfo.attach('recorded-failure-bundle.json', {
    body: Buffer.from(JSON.stringify(bundle, null, 2)),
    contentType: 'application/json'
  });
});

test('refuses changed datasets and fixtures', () => {
  const changedDataset = {
    ...inputs,
    datasetBytes: Buffer.concat([inputs.datasetBytes, Buffer.from('\n')])
  };
  const changedFixtures = {
    ...inputs,
    fixtureBytes: Buffer.concat([inputs.fixtureBytes, Buffer.from('\n')])
  };

  expect(() => validateReplay(bundle, changedDataset)).toThrow(/Dataset hash mismatch/);
  expect(() => validateReplay(bundle, changedFixtures)).toThrow(/Fixture hash mismatch/);
});

test('rejects observations changed after capture', () => {
  const changedBundle: EvaluationBundle = structuredClone(bundle);
  changedBundle.observations[0].predictedIntent = 'SOFTWARE';

  expect(() => validateReplay(changedBundle, inputs)).toThrow(
    /Recorded prediction does not match response for VPN-001/
  );
});

test('identifies newly failing cases by stable case ID', () => {
  const baseline = bundle.observations;
  const candidate = structuredClone(baseline);
  candidate[0].passed = false;
  candidate[3].passed = true;

  expect(findNewFailures(baseline, candidate)).toEqual(['VPN-001']);
  expect(() => findNewFailures(baseline, candidate.slice(1))).toThrow(
    /different case IDs/
  );
});
