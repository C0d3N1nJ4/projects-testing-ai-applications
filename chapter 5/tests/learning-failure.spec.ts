import { test, expect } from '@playwright/test';
import { ExactEvaluator } from '../src/evaluators/exact';

test('DEMONSTRATION: an acceptable paraphrase fails exact matching', async () => {
  const result = await new ExactEvaluator().evaluate({
    id: 'VPN-PARAPHRASE',
    question: 'How do I reconnect?',
    expectedAnswer: 'Reconnect to your corporate VPN.',
    actual: 'Connect to the company VPN again.',
    requiredConcepts: [],
    forbiddenPatterns: []
  });

  expect(result.passed).toBe(true);
});