export type TestProfile = 'mock' | 'local-ai';

export interface TestEnvironment {
  profile: TestProfile;
  supportApiBaseUrl: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
}

const profile = process.env.TEST_PROFILE ?? 'mock';
if (profile !== 'mock' && profile !== 'local-ai') {
  throw new Error(`Unsupported TEST_PROFILE: ${profile}`);
}

export const environment: TestEnvironment = {
  profile,
  supportApiBaseUrl: process.env.SUPPORT_API_URL ?? 'http://127.0.0.1:3987',
  ollamaBaseUrl: process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434',
  ollamaModel: process.env.OLLAMA_MODEL ?? 'llama3.2:3b'
};