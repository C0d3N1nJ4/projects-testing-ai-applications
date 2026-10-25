# Chapter 7 Companion Project

This standalone TypeScript and Playwright project demonstrates tests for an AI agent's tool-execution boundary. Its deterministic in-memory harness models ticket reads, approval, authorization, state changes, retries, and audit traces. It does not run an LLM or connect to a real ticket service; passing tests demonstrate the harness's safety contract, not live-model tool-selection quality.

## Run the standard suite

From this directory:

```bash
npm install
npm run typecheck
npm test
```

The suite verifies read-before-approval ordering, viewer and tenant authorization, approval state and argument binding, expiration, stale ticket versions, idempotency, and retry behavior. The happy-path test attaches a structured `agent-trace` to the Playwright result. The standard suite writes HTML, JUnit, and JSON reports; open `reports/html/index.html` to inspect the HTML report.

## Run the intentional learning failure

```bash
npm run test:learning
```

This isolated test is expected to fail because it incorrectly expects an update without approval to succeed. The harness correctly rejects the operation with `APPROVAL_REQUIRED`. Change `.not.toThrow()` to `.toThrow('APPROVAL_REQUIRED')` and rerun the learning suite to make it pass. This failing exercise is excluded from `npm test`.

## Harness boundaries

The harness uses an in-memory ticket store and a deterministic clock in tests. It models backend checks for actor role, tenant access, approval state, exact actor/ticket/priority arguments, approval expiry, ticket version, and one effective update per idempotency key. The approval decision method omits reviewer identity and authentication to keep the example focused; a production system must authenticate approvers, persist and protect approvals, and enforce idempotency atomically with the business mutation.

The trace is instructional evidence rather than a tamper-resistant audit log. Do not use this project as proof of production authorization, persistence, concurrency, or model quality. Test real service integrations and evaluate live-model tool proposals separately.
