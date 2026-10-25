export type Label = 'PASS' | 'PARTIAL' | 'FAIL';

export interface EvaluationInput {
  id: string;
  question: string;
  actual: string;
  expectedAnswer: string;
  requiredConcepts: Array<{ id: string; patterns: string[] }>;
  forbiddenPatterns: string[];
}

export interface EvaluationResult {
  evaluator: string;
  version: string;
  score: number;
  label: Label;
  passed: boolean;
  evidence: string[];
  criticalViolation: boolean;
}

export interface Evaluator {
  evaluate(input: EvaluationInput): Promise<EvaluationResult>;
}