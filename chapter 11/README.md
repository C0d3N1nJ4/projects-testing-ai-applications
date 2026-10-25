# Chapter 11 Companion Project

This standalone TypeScript and Playwright project compares two deterministic performance-test configurations over the same four AI Support Desk cases. It records end-to-end latency, time to first content chunk, model duration, synthetic token usage, fictional-rate cost estimates, phrase-based quality coverage, and sanitized operation spans.

These are controlled test doubles, not live LLMs, provider benchmarks, production pricing, or OpenTelemetry traces. Timing is measured with Node.js's monotonic `performance.now()` clock; the request simulations use short waits, so exact values vary with machine scheduling.

## Run the comparison

From this directory:

```bash
npm install
npm run typecheck
npm test
```

The Playwright comparison attaches `quality-performance-evidence.json` to its test result and writes HTML, JUnit, and JSON reports to `reports/`. To inspect the HTML report:

```bash
npm run test:report
```

## Understand the comparison

Both configurations run against the same versioned cases in `datasets/performance-cases.json`. The `fast` profile simulates shorter waits, lower fictional rates, lower token counts, and omits the IT escalation instruction in the VPN answer. The `careful` profile simulates longer waits and returns the complete reference answers.

The report includes nearest-rank p50 and p95 latency, p50 first-chunk latency, serial requests per second calculated from elapsed wall-clock time, token totals, estimated costs, and average required-fact phrase coverage. The small dataset makes p95 unstable; it is included to demonstrate the calculation, not to claim a reliable service-level estimate. Phrase matching is instructional, not a semantic quality evaluator.

Each result includes a trace ID and JSON spans for retrieval and generation. Span attributes contain case/configuration and synthetic usage metadata; prompts are excluded. These local evidence spans are not automatically exported OpenTelemetry traces, and first-chunk latency is not provider-reported time to first token.

## Extend the exercise

For meaningful production comparisons, add warm-up and larger repeated samples, report failure rates, test controlled concurrency, use provider-reported usage and a versioned external rate schedule, and apply a calibrated semantic evaluator. Keep quality/safety release constraints separate from performance and cost tradeoffs.
