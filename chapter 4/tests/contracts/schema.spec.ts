import { test, expect } from '@playwright/test';
import { ClassificationSchema } from '../../src/schemas/classification.js';

const validClassification = {
  intent: 'INCIDENT',
  category: 'NETWORK',
  action: 'CREATE_TICKET',
  rationale: 'The VPN connection is failing.'
};

test('accepts a valid classification', () => {
  expect(ClassificationSchema.safeParse(validClassification).success).toBe(true);
});

test('rejects an unsupported intent', () => {
  expect(ClassificationSchema.safeParse({ ...validClassification, intent: 'MAYBE' }).success).toBe(false);
});

test('rejects missing required fields', () => {
  const { rationale: _rationale, ...missingRationale } = validClassification;
  expect(ClassificationSchema.safeParse(missingRationale).success).toBe(false);
});

test('rejects unexpected properties', () => {
  expect(
    ClassificationSchema.safeParse({ ...validClassification, confidentialToken: 'not-allowed' }).success
  ).toBe(false);
});

test('rejects a rationale outside its length limits', () => {
  expect(ClassificationSchema.safeParse({ ...validClassification, rationale: 'OK' }).success).toBe(false);
});