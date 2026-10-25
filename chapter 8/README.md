# Chapter 8 Companion Project

This standalone TypeScript and Playwright project exercises a complete browser-to-API ticket journey. It includes a small HTTP service, a browser UI, deterministic AI guidance, approval-gated resolution, an in-memory ticket store, and correlated audit events. It does not require a real LLM, external ticket service, or database.

## Run the project

From this directory:

```bash
npm install
npm run typecheck
npm test
```

Playwright starts the service automatically, waits for its health endpoint, and then runs browser and API assertions against the same instance. The UI is available at `http://127.0.0.1:4178` while the service is running. Install the Playwright Chromium browser if your environment does not already have it:

```bash
npx playwright install chromium
```

The suite verifies ticket creation, deterministic guidance, pending state, approval authorization, approval-before-execution ordering, final UI and API state, replay idempotency, and a single effective update event. The journey attaches structured `journey-evidence` to the Playwright result. HTML, JUnit, and JSON reports are written to `reports/`.

To open the HTML report after a run:

```bash
npm run test:report
```

## Run the learning exercise

The intentionally incorrect assertion is skipped in the regular test suite. To observe it fail, temporarily remove `test.skip` from `tests/learning-failure.spec.ts`, then run:

```bash
npx playwright test tests/learning-failure.spec.ts
```

The ticket is correctly created with status `OPEN`, so expecting `RESOLVED` immediately is a test-design error. Restore `test.skip` after examining the failure.

## Harness boundaries

AI guidance is a deterministic fixture, not a model-quality evaluation. Ticket records and audit events are held in memory and reset by the tests. The `x-user-role` header is a teaching-only authorization fixture, not authentication; do not deploy this service or its reset/audit endpoints as production controls. The example demonstrates E2E evidence collection, not durable persistence, production authorization, cryptographic approval, distributed idempotency, or live-model tool selection.
