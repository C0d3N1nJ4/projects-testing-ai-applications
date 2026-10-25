# Chapter 3 Companion Project

This is the runnable TypeScript and Playwright framework built in Chapter 3. It separates the support API client from model-provider adapters, starts a small in-process API fixture for each test, defaults to deterministic mocks, and saves test reports and model-response evidence.

## Requirements

- Node.js 22 or newer and npm
- Ollama only for the optional local-AI profile

## Run the mock profile

From the repository root:

```bash
cd "chapter 3"
npm install
npm run typecheck
npm run test:mock
```

No browser installation, API credentials, or Ollama process is needed. The support API and model response are controlled test doubles. A passing mock suite checks the framework and contracts; it does not establish real-model quality.

## Run the optional local-AI profile

Start Ollama and pull the default model:

```bash
ollama pull llama3.2:3b
TEST_PROFILE=local-ai npm run test:local-ai
```

The model adapter sends requests to `/api/chat`. Configure the endpoint and model with `OLLAMA_URL` and `OLLAMA_MODEL`; defaults are `http://127.0.0.1:11434` and `llama3.2:3b`. The support API remains the local deterministic fixture in both profiles. The model test is a response smoke test, not a semantic-quality evaluation.

## Demonstrate a failing assertion

```bash
npm run test:failure
```

This command is expected to fail: the learning test expects `HARDWARE`, but the fixture returns `NETWORK`. The ordinary mock suite excludes this test and remains green.

## Reports

The test run creates `playwright-report/index.html`, `reports/junit.xml`, and `reports/results.json`. Use `npm run report` to open the HTML report. Generated artifacts and local credentials are excluded from Git.

## Project layout

```text
data/vpn-policy.ts
src/clients/support-desk-client.ts
src/config/environment.ts
src/fixtures/mock-support-api.ts
src/fixtures/test-fixtures.ts
src/providers/model-provider.ts
src/providers/mock-provider.ts
src/providers/ollama-provider.ts
tests/api/ticket-api.spec.ts
tests/learning/intentional-failure.spec.ts
tests/model/model-response.spec.ts
```