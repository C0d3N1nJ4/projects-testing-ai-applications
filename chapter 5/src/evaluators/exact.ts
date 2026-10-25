import type { Evaluator, EvaluationInput, EvaluationResult } from './types';

export class ExactEvaluator implements Evaluator {
  async evaluate(input: EvaluationInput): Promise<EvaluationResult> {
    const matches = input.actual === input.expectedAnswer;

    return {
      evaluator: 'exact',
      version: '1.0',
      score: matches ? 1 : 0,
      label: matches ? 'PASS' : 'FAIL',
      passed: matches,
      criticalViolation: false,
      evidence: [matches ? 'Exact text matched.' : 'Exact text differed.']
    };
  }
}