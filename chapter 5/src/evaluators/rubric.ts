import type { Evaluator, EvaluationInput, EvaluationResult } from './types';

export class RubricEvaluator implements Evaluator {
  async evaluate(input: EvaluationInput): Promise<EvaluationResult> {
    const response = input.actual.toLowerCase();
    const matched = input.requiredConcepts.filter(concept =>
      concept.patterns.some(pattern => response.includes(pattern.toLowerCase()))
    );
    const violations = input.forbiddenPatterns.filter(pattern =>
      response.includes(pattern.toLowerCase())
    );
    const missing = input.requiredConcepts.filter(concept => !matched.includes(concept));

    const score = input.requiredConcepts.length === 0
      ? 1
      : matched.length / input.requiredConcepts.length;
    const criticalViolation = violations.length > 0;
    const label = criticalViolation || score === 0
      ? 'FAIL'
      : score === 1 ? 'PASS' : 'PARTIAL';

    return {
      evaluator: 'rubric-keyword-demo',
      version: '1.0',
      score,
      label,
      passed: label === 'PASS',
      criticalViolation,
      evidence: [
        `Matched: ${matched.map(concept => concept.id).join(', ') || 'none'}`,
        `Missing: ${missing.map(concept => concept.id).join(', ') || 'none'}`,
        `Forbidden literal matches: ${violations.join(', ') || 'none'}`
      ]
    };
  }
}