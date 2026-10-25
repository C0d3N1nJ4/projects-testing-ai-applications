# Chapter 4 Companion Project

This runnable TypeScript and Playwright project demonstrates prompt versioning, structured response validation, data-driven classification tests, and a deliberate behavior regression. The mock profile is deterministic and does not need a model. It verifies the test harness, not real-model quality.

## Requirements

- Node.js 22 or newer and npm
- Ollama only for the optional local-model profile

## Run the mock suite

From the repository root:

```bash
cd "chapter 4"
npm install
npm run typecheck
npm run test:mock
```

The mock suite should pass without browser installation or an Ollama process. Playwright writes an HTML report to `playwright-report/` and JUnit and JSON reports to `test-results/`. Open the HTML report with `npm run report`.

## Demonstrate a regression

```bash
npm run test:regression-demo
```

This command is expected to fail: the regression profile changes incident actions from `CREATE_TICKET` to `ANSWER`, while leaving the response valid JSON and schema-compliant. Run `npm run test:mock` to return to the passing baseline.

## Optional Ollama profile

Start Ollama and pull the default model:

```bash
ollama pull llama3.2:3b
npm run test:local-ai
```

Configure a different Ollama endpoint or model with `OLLAMA_URL` and `OLLAMA_MODEL`. Defaults are `http://127.0.0.1:11434` and `llama3.2:3b`. Real-model runs may fail classification assertions; review the case, label policy, prompt version, model, and raw response before changing expected labels.

## Project layout

```text
datasets/classification-cases.json
src/config/env.ts
src/prompts/ticket-classifier.ts
src/providers/classifier.ts
src/schemas/classification.ts
tests/classification/intent.spec.ts
tests/contracts/schema.spec.ts
playwright.config.ts
```

The five seed cases are illustrative, not a statistically representative evaluation dataset. See Chapter 5 for broader evaluation methods.