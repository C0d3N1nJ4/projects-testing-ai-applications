# Chapter 5 Companion Project

This standalone TypeScript and Playwright exercise demonstrates exact-string evaluation, a requirement-based lexical rubric, human-label comparison, and an intentionally failing exact-match test. The four-case VPN dataset is synthetic teaching data, not a representative or release-calibrated evaluation set.

## Requirements

- Node.js 22 or newer and npm

No browser binaries, model server, API credentials, or network service are needed.

## Run the chapter exercise

From the repository root:

```bash
cd "chapter 5"
npm install
npm run typecheck
npm run test:chapter5
```

The evaluation test attaches `chapter5-evaluation.json` with per-case exact and rubric results, human labels, agreement, and a confusion matrix. Playwright also generates HTML, JUnit, and JSON reports under `playwright-report/` and `reports/`.

## Run the expected failure

```bash
npm run test:chapter5:failure
```

This test is expected to fail because an exact-string evaluator rejects a paraphrase. The normal chapter suite excludes it.

## Important limitations

The rubric evaluator checks case-insensitive literal substring patterns. It can miss paraphrases and misunderstand negation, so it is a pedagogical lexical proxy, not a semantic evaluator or safety guarantee. The exact evaluator does not inspect safety; its `criticalViolation: false` result is not evidence that an answer is safe. The human labels are hand-authored for this tiny dataset; agreement on these examples does not demonstrate evaluator calibration or readiness for a release gate. Review disagreements and critical failures rather than relying on one aggregate score.