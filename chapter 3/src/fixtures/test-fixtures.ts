import { test as base, expect } from '@playwright/test';
import type { Server } from 'node:http';
import { SupportDeskClient } from '../clients/support-desk-client';
import { environment } from '../config/environment';
import { createMockSupportApi } from './mock-support-api';
import type { ModelProvider } from '../providers/model-provider';
import { MockProvider } from '../providers/mock-provider';
import { OllamaProvider } from '../providers/ollama-provider';

type Fixtures = {
  supportDesk: SupportDeskClient;
  modelProvider: ModelProvider;
};

export const test = base.extend<Fixtures>({
  supportDesk: async ({ request }, use) => {
    const server: Server = createMockSupportApi();
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No mock API port was assigned.');

    try {
      await use(new SupportDeskClient(request, `http://127.0.0.1:${address.port}`));
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close(error => error ? reject(error) : resolve())
      );
    }
  },
  modelProvider: async ({ request }, use) => {
    const provider: ModelProvider = environment.profile === 'local-ai'
      ? new OllamaProvider(request, environment.ollamaBaseUrl, environment.ollamaModel)
      : new MockProvider();
    await use(provider);
  }
});

export { expect };