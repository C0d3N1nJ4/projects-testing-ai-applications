import type { APIRequestContext } from '@playwright/test';
import type { ModelProvider, ModelRequest, ModelResult } from './model-provider';

export class OllamaProvider implements ModelProvider {
  constructor(
    private readonly http: APIRequestContext,
    private readonly baseUrl: string,
    private readonly model: string
  ) {}

  async generate(input: ModelRequest): Promise<ModelResult> {
    const response = await this.http.post(`${this.baseUrl.replace(/\/$/, '')}/api/chat`, {
      data: {
        model: this.model,
        stream: false,
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user }
        ],
        options: { temperature: 0.2 }
      },
      timeout: 120_000
    });

    if (!response.ok()) {
      throw new Error(`Ollama request failed: ${response.status()} ${await response.text()}`);
    }

    const data: unknown = await response.json();
    if (!isChatResponse(data)) {
      throw new Error('Unexpected Ollama response structure.');
    }

    return { text: data.message.content, provider: 'ollama', model: this.model };
  }
}

function isChatResponse(value: unknown): value is {
  message: { content: string };
} {
  if (typeof value !== 'object' || value === null || !('message' in value)) return false;
  const message = value.message;
  return typeof message === 'object' && message !== null
    && 'content' in message && typeof message.content === 'string';
}