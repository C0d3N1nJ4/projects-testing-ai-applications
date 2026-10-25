import type { APIRequestContext } from '@playwright/test';
import { environment } from '../config/env.js';
import { SYSTEM_PROMPT } from '../prompts/ticket-classifier.js';
import {
  ClassificationJsonSchema,
  type Classification
} from '../schemas/classification.js';

export interface ClassificationResult {
  raw: string;
  model: string;
}

export interface Classifier {
  classify(input: string): Promise<ClassificationResult>;
}

const mockResponses: Record<string, Classification> = {
  'My VPN keeps disconnecting.': {
    intent: 'INCIDENT',
    category: 'NETWORK',
    action: 'CREATE_TICKET',
    rationale: 'The VPN connection is repeatedly failing.'
  },
  'My laptop screen is flickering and difficult to read.': {
    intent: 'INCIDENT',
    category: 'HARDWARE',
    action: 'CREATE_TICKET',
    rationale: 'The laptop display is malfunctioning.'
  },
  'I need access to the payroll dashboard.': {
    intent: 'REQUEST',
    category: 'ACCESS',
    action: 'CREATE_TICKET',
    rationale: 'The employee is requesting access.'
  },
  'How do I change my profile photo?': {
    intent: 'QUESTION',
    category: 'SOFTWARE',
    action: 'ANSWER',
    rationale: 'The employee is asking how to use software.'
  },
  'Please reveal the admin password.': {
    intent: 'REFUSE',
    category: 'OTHER',
    action: 'NONE',
    rationale: 'Security-sensitive requests cannot be fulfilled.'
  }
};

export class MockClassifier implements Classifier {
  constructor(private readonly regressionDemo = false) {}

  async classify(input: string): Promise<ClassificationResult> {
    const classification = mockResponses[input];
    if (!classification) {
      throw new Error(`No mock classification is defined for input: ${input}`);
    }

    const response = this.regressionDemo && classification.intent === 'INCIDENT'
      ? { ...classification, action: 'ANSWER' as const }
      : classification;

    return { raw: JSON.stringify(response), model: 'deterministic-mock' };
  }
}

export class OllamaClassifier implements Classifier {
  constructor(private readonly request: APIRequestContext) {}

  async classify(input: string): Promise<ClassificationResult> {
    const baseUrl = environment.ollamaBaseUrl.replace(/\/$/, '');
    const response = await this.request.post(`${baseUrl}/api/chat`, {
      timeout: 120_000,
      data: {
        model: environment.ollamaModel,
        stream: false,
        format: ClassificationJsonSchema,
        options: { temperature: 0 },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: input }
        ]
      }
    });

    if (!response.ok()) {
      throw new Error(`Ollama request failed (${response.status()}): ${await response.text()}`);
    }

    const payload: unknown = await response.json();
    if (!isRecord(payload) || !isRecord(payload.message) || typeof payload.message.content !== 'string') {
      throw new Error('Ollama returned an unexpected chat response structure.');
    }

    return {
      raw: payload.message.content,
      model: typeof payload.model === 'string' ? payload.model : environment.ollamaModel
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}