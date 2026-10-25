import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2:3b';
const TEMPERATURE = Number(process.env.TEMPERATURE ?? '0.8');
const OLLAMA_URL = (process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434').replace(/\/$/, '');
const RUNS = 8;

const POLICY = `
Corporate VPN Support Policy:
1. Open VPN settings.
2. Select the corporate VPN profile.
3. Attempt to reconnect.
4. If reconnection fails, contact IT support.
5. Never share passwords.
`;

const QUESTION = 'My corporate VPN keeps disconnecting. What should I do?';

interface GeneratedResponse {
  run: number;
  model: string;
  output: string;
  elapsedMs: number;
}

interface OllamaChatResponse {
  model?: string;
  message?: {
    content?: unknown;
  };
}

test('observe response variability across repeated requests', async ({ request }, testInfo) => {
  expect(Number.isFinite(TEMPERATURE)).toBe(true);
  expect(TEMPERATURE).toBeGreaterThanOrEqual(0);

  const results: GeneratedResponse[] = [];

  for (let run = 1; run <= RUNS; run++) {
    const start = Date.now();
    const response = await request.post(`${OLLAMA_URL}/api/chat`, {
      data: {
        model: MODEL,
        stream: false,
        messages: [
          { role: 'system', content: `Answer using only this policy:\n${POLICY}` },
          { role: 'user', content: QUESTION }
        ],
        options: { temperature: TEMPERATURE }
      },
      timeout: 120_000
    });

    expect(
      response.ok(),
      `Ollama returned HTTP ${response.status()}: ${await response.text()}`
    ).toBe(true);

    const body = await response.json() as OllamaChatResponse;
    const output = typeof body.message?.content === 'string' ? body.message.content : '';
    expect(output.trim().length, 'Ollama should return nonempty assistant content').toBeGreaterThan(0);

    results.push({
      run,
      model: typeof body.model === 'string' ? body.model : MODEL,
      output,
      elapsedMs: Date.now() - start
    });
    console.log(`\nRun ${run}:\n${output}\n`);
  }

  const uniqueCount = new Set(results.map(result => result.output.trim())).size;
  const artifact = {
    model: MODEL,
    temperature: TEMPERATURE,
    question: QUESTION,
    referencePolicy: POLICY.trim(),
    runCount: RUNS,
    uniqueCount,
    uniqueStringRatio: uniqueCount / RUNS,
    results
  };

  console.log(`Unique responses: ${uniqueCount} of ${RUNS}`);
  await mkdir('results', { recursive: true });
  const artifactPath = `results/variability-temp-${TEMPERATURE}.json`;
  const artifactContent = JSON.stringify(artifact, null, 2);
  await writeFile(artifactPath, artifactContent);
  await testInfo.attach('variability-results.json', {
    body: Buffer.from(artifactContent),
    contentType: 'application/json'
  });
});