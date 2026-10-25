# Chapter 13 Companion Project

This TypeScript and Playwright project demonstrates a paired AI-quality release gate and a packaged GitHub Actions workflow. It uses synthetic scores so the decision is deterministic; it does not call an LLM or measure production quality.

## Run locally

From the repository root:

```bash
cd "chapter 13"
npm install
npm run typecheck
npm test
npm run gate
```

`npm run gate` evaluates the baseline profile, where candidate scores equal baseline scores. It should pass and write `artifacts/quality-gate.json`.

To run the intentionally degraded candidate profile:

```bash
npm run gate:regression
```

This command is expected to exit nonzero, print a GitHub Actions `::error` annotation, and write the result to `artifacts/quality-gate.json`. The standard test command excludes the deliberately failing `@learning` example. Run it explicitly with:

```bash
npm run test:learning
```

That test is expected to fail because it incorrectly expects the degraded candidate to pass. HTML, JUnit, and JSON Playwright reports are written to `reports/`; inspect the HTML report with `npm run test:report`.

## GitHub Actions

The packaged workflow is `.github/workflows/chapter-13-ai-quality.yml`. To enable it in this repository, copy it to the repository's `.github/workflows/` directory, then commit the generated `package-lock.json`. Its pull-request, main-branch push, and Monday scheduled runs execute typechecking, tests, the baseline gate, and artifact upload. A manual run with `demonstrate_regression` enabled intentionally fails at the gate while retaining its report and annotation.

The workflow requests read-only repository permissions, cancels superseded runs on the same ref, and requests 30-day retention for artifacts. The `test-and-gate` job should be configured as a required status check in branch protection or a ruleset if it is intended to block merges.

## Gate policy and limitations

The illustrative policy uses at least 15 paired cases, an absolute candidate-quality floor of `0.80`, an unacceptable regression margin of `0.05`, and 4,000 paired-bootstrap resamples with seed `42`. The interval uses the nearest-rank 95% percentile. A candidate below the floor or with its entire interval below `-0.05` is blocked. An undersized dataset or interval that overlaps the unacceptable region is inconclusive, and both block release. Only a result meeting the floor with no established unacceptable regression passes.

`datasets/paired-quality.json` contains synthetic scores only. The baseline profile makes candidate values equal to baseline values; the regression profile uses the lower candidate scores recorded in the dataset. For real use, replace these fixtures with versioned, matched evaluator results and preserve the dataset checksum, model/provider configuration, evaluator version, labels, and case-level evidence. Bootstrap intervals do not repair biased or dependent cases, and a nonsignificant result is not proof of equivalence.
