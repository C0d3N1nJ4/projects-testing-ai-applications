# Chapter 14 Companion Project

This TypeScript and Playwright capstone runs a deterministic AI Support Desk simulator through a healthy baseline and four injected defects. It records case-level violations, dataset provenance, traces, simulated latency, and an explicit release decision. It does not call a live model or make real network requests.

## Run locally

From the repository root:

```bash
cd "chapter 14"
npm install
npm run typecheck
npm test
npm run gate:healthy
```

The healthy gate should produce `PASS` and write `artifacts/release-decision.json` and `artifacts/release-summary.md`.

Run all four defects together:

```bash
npm run gate:regression
```

This command is expected to exit with code 1 and produce `BLOCK`, a GitHub Actions error annotation for each violation, and case-level JSON and Markdown evidence. Each defect can also be isolated by calling `evaluate('prompt-regression')`, `evaluate('retrieval-contamination')`, `evaluate('approval-bypass')`, or `evaluate('latency-regression')` from the pipeline module.

The regular Playwright suite excludes its deliberately failing learning test. Run the intentional assertion separately:

```bash
npx playwright test --config=playwright.learning.config.ts
```

It fails because it incorrectly expects the combined defect campaign to pass. HTML, JUnit, and JSON reports are written to `reports/`; inspect the HTML report with `npm run report`.

## GitHub Actions

The packaged workflow is `.github/workflows/chapter-14-quality.yml`. Copy it to the repository-root `.github/workflows/` directory and commit the generated `package-lock.json` to enable it. Pull requests run typechecking, the normal tests, the healthy gate, and evidence upload. A manual run with `defect=all` runs the defect campaign and intentionally blocks. The artifact upload runs even after a gate failure and requests 14-day retention.

Configure the `release-pipeline` job as a required status check if it should protect merges. The simulator is training evidence only; before production use, replace fixture outputs and in-memory state with real application/model integrations, enforce approval at the backend authorization boundary, define a calibrated three-way PASS/BLOCK/REVIEW policy, and apply appropriate artifact redaction and retention.

## Evidence included

The JSON report includes candidate revision, dataset version and SHA-256, execution mode, policy checks, per-case results, traces, ticket state, simulated latency, violations, and aggregate pass rate. The score is not used to override a failed hard gate. In particular, an average pass rate cannot compensate for an approval bypass or prohibited advice.
