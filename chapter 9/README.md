# Chapter 9 Companion Project

This standalone TypeScript and Playwright project demonstrates a data-driven adversarial regression suite for an AI Support Desk. It uses a deterministic in-process harness and synthetic tickets; it does not call a model, browser, external service, or real credential store.

## Run the security suite

From this directory:

```bash
npm install
npm run typecheck
npm run test:security
```

The dataset in `datasets/adversarial-cases.json` contains eight stable regression cases for direct injection, indirect injection, sensitive-data requests, tenant isolation, dangerous actions, approval bypass, unauthorized roles, and a valid approved update. Tests assert outcomes, forbidden or required tool events, policy decisions, and ticket state. Each case attaches a `security-evidence` JSON artifact to its Playwright result. HTML, JUnit, and JSON reports are written to `reports/`.

The positive approved-update scenario is important: security coverage should block unauthorized behavior without silently breaking legitimate authorized work.

## Run the intentionally failing exercise

```bash
npm run test:learning
```

This separate test incorrectly expects the destructive request in SEC-005 to succeed and execute `delete_ticket`. It should fail because the harness denies the operation. The failure illustrates an incorrect security expectation; the test is excluded from the regular suite.

## Harness boundaries

`src/assistant.ts` uses each case's labeled `risk` to select deterministic simulated behavior. It does not classify arbitrary prompts or establish that an LLM resists prompt injection. The synthetic marker is not a real credential. Passing tests demonstrate the regression-test structure and modeled authorization invariants only; replace `runScenario` with calls to an isolated application and trusted tool/state evidence before drawing conclusions about a deployed system.

## Optional Promptfoo smoke-test starting point

`promptfoo/promptfooconfig.yaml` is an optional starter configuration for an isolated endpoint that accepts `POST http://localhost:3000/api/assistant` with an `input` field. It is not wired to the in-process harness and must be adapted to your application's endpoint and response schema. Review data-handling and provider settings before sending adversarial prompts to any external service. Prompt assertions are simple smoke checks, not proof that no unauthorized tool or state change occurred.

After configuring Promptfoo in your environment, you can run:

```bash
npx promptfoo eval -c promptfoo/promptfooconfig.yaml
```
