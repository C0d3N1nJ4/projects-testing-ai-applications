# Chapter 10 Companion Project

This standalone TypeScript and Playwright project demonstrates deterministic fault injection for an AI dependency and an idempotent ticket store. It requires no browser, model API key, external service, or Spring application.

## Run the tests

From this directory:

```bash
npm install
npm run typecheck
npm test
```

The tests cover transient provider recovery, rate-limit delays, malformed outputs, invalid structured actions, context-limit failures, fallback, a bounded timeout, missing approval, and safe retry after a committed update loses its acknowledgement. Evidence is attached to Playwright results as `reliability-evidence`; HTML, JUnit, and JSON reports are written to `reports/`.

`ScriptedProvider` consumes configured steps and records call counts. Tests inject a sleep function to record backoff without waiting in real time. The timeout test uses a controllable provider that never completes and verifies the caller's deadline.

## Run the intentionally failing exercise

```bash
npm run test:learning
```

The separate test incorrectly expects replaying the same operation ID to create two effective updates. It should fail because `TicketStore` deduplicates the logical operation. This exercise is excluded from the normal test project.

## Reliability and fidelity limits

The retry delays are deterministic and do not include production jitter. `TicketStore` is synchronous and in-memory; its operation map does not provide durable or cross-process idempotency. The scripted dependency does not reproduce provider behavior, cancellation guarantees, or network uncertainty. Passing tests demonstrate the modeled recovery policy and invariants, not production availability or live-model reliability.
