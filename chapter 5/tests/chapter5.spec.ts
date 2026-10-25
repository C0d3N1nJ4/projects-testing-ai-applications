import { test, expect } from '@playwright/test';
import cases from '../datasets/vpn-golden.json';
import { ExactEvaluator } from '../src/evaluators/exact';
import { RubricEvaluator } from '../src/evaluators/rubric';
import type { EvaluationInput, Label } from '../src/evaluators/types';

const exact = new ExactEvaluator();
const rubric = new RubricEvaluator();
const labels: Label[] = ['PASS', 'PARTIAL', 'FAIL'];

interface EvaluationRecord {
  id: string;
  risk: string;
  slice: string;
  sourceVersion: string;
  human: Label;
  exact: Label;
  exactScore: number;
  rubric: Label;
  rubricScore: number;
  criticalViolation: boolean;
  evidence: string[];
}

test('compares exact and rubric results against human labels', async ({}, testInfo) => {
  const records: EvaluationRecord[] = [];
  for (const item of cases) {
    const input: EvaluationInput = item;
    const [exactResult, rubricResult] = await Promise.all([
      exact.evaluate(input),
      rubric.evaluate(input)
    ]);
    records.push({
      id: item.id,
      risk: item.risk,
      slice: item.slice,
      sourceVersion: item.sourceVersion,
      human: item.expectedLabel as Label,
      exact: exactResult.label,
      exactScore: exactResult.score,
      rubric: rubricResult.label,
      rubricScore: rubricResult.score,
      criticalViolation: rubricResult.criticalViolation,
      evidence: rubricResult.evidence
    });
  }

  const agreement = records.filter(record => record.rubric === record.human).length / records.length;
  const confusionMatrix = Object.fromEntries(labels.map(human => [
    human,
    Object.fromEntries(labels.map(evaluator => [
      evaluator,
      records.filter(record => record.human === human && record.rubric === evaluator).length
    ]))
  ]));
  const report = {
    dataset: 'vpn-golden-v1',
    sampleSize: records.length,
    rubricAgreement: agreement,
    confusionMatrix,
    records
  };

  console.table(records.map(({ id, human, exact: exactLabel, rubric: rubricLabel, rubricScore }) => ({
    id,
    human,
    exact: exactLabel,
    rubric: rubricLabel,
    score: rubricScore
  })));

  await testInfo.attach('chapter5-evaluation.json', {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: 'application/json'
  });
  expect(records.length).toBeGreaterThan(0);
  expect(agreement).toBeGreaterThanOrEqual(0);
});