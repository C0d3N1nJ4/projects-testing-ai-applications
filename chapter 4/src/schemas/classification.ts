import { z } from 'zod';

export const INTENTS = ['INCIDENT', 'REQUEST', 'QUESTION', 'REFUSE'] as const;
export const CATEGORIES = ['NETWORK', 'HARDWARE', 'SOFTWARE', 'ACCESS', 'OTHER'] as const;
export const ACTIONS = ['CREATE_TICKET', 'ANSWER', 'ESCALATE', 'NONE'] as const;

export const ClassificationSchema = z.object({
  intent: z.enum(INTENTS),
  category: z.enum(CATEGORIES),
  action: z.enum(ACTIONS),
  rationale: z.string().min(3).max(240)
}).strict();

export type Classification = z.infer<typeof ClassificationSchema>;

export const ClassificationJsonSchema = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: INTENTS },
    category: { type: 'string', enum: CATEGORIES },
    action: { type: 'string', enum: ACTIONS },
    rationale: { type: 'string', minLength: 3, maxLength: 240 }
  },
  required: ['intent', 'category', 'action', 'rationale'],
  additionalProperties: false
} as const;