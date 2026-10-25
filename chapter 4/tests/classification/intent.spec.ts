import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { environment } from '../../src/config/env.js';
import {
  MockClassifier,
  OllamaClassifier,
  type Classifier
} from '../../src/providers/classifier.js';
import { PROMPT_VERSION } from '../../src/prompts/ticket-classifier.js';
import { ClassificationSchema } from '../../src/schemas/classification.js';

interface ClassificationCase {
  id: string;
  input: string;
  expected: {
    intent: string;
    category: string;
    action: string;
  };
  risk: string;
}

const cases = JSON.parse(
  readFileSync(new URL('../../datasets/classification-cases.json', import.meta.url), 'utf8')
) as ClassificationCase[];
const DATASET_VERSION = 'classification-v1';

test.describe('ticket classification contract', () => {
  for (const classificationCase of cases) {
    test(`${classificationCase.id} | ${classificationCase.risk} | ${PROMPT_VERSION}`, async (
      { request },
      testInfo
    ) => {
      const classifier: Classifier = testInfo.project.name === 'local-ai'
        ? new OllamaClassifier(request)
        : new MockClassifier(testInfo.project.name === 'regression-demo');

      const result = await classifier.classify(classificationCase.input);
      await testInfo.attach('model-response.json', {
        body: JSON.stringify({
          caseId: classificationCase.id,
          risk: classificationCase.risk,
          datasetVersion: DATASET_VERSION,
          promptVersion: PROMPT_VERSION,
          profile: testInfo.project.name,
          model: result.model,
          generation: testInfo.project.name === 'local-ai'
            ? { temperature: 0, format: 'json-schema' }
            : null,
          raw: result.raw
        }, null, 2),
        contentType: 'application/json'
      });

      let parsed: unknown;
      try {
        parsed = JSON.parse(result.raw) as unknown;
      } catch {
        throw new Error('Model output should be valid JSON.');
      }

      const validated = ClassificationSchema.safeParse(parsed);
      expect(
        validated.success,
        validated.success ? 'classification schema is valid' : validated.error.message
      ).toBe(true);
      if (!validated.success) return;

      expect(validated.data.intent).toBe(classificationCase.expected.intent);
      expect(validated.data.category).toBe(classificationCase.expected.category);
      expect(validated.data.action).toBe(classificationCase.expected.action);
      expect(validated.data.rationale.length).toBeGreaterThanOrEqual(3);
      expect(validated.data.rationale.length).toBeLessThanOrEqual(240);
    });
  }
});