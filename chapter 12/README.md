# Chapter 12 Companion Project

This TypeScript and Playwright exercise captures a deterministic classification failure, records the exact dataset and fixture hashes, and replays the saved evidence. The simulator deliberately labels `SW-004` as `NETWORK` instead of `SOFTWARE`; it is a test double, not a live model evaluation.

## Run the exercise

From the repository root:

```bash
cd "chapter 12"
npm install
npm run typecheck
npm run capture
npm run replay
npm test
```

`capture` writes `artifacts/recorded-failure/bundle.json`. It refuses to overwrite an existing bundle so the original failure remains available as evidence. Archive that bundle before starting a new capture. `replay` verifies the recorded dataset and fixture hashes, case IDs, predictions, and recalculated score without making a model request.

Expected illustrative output:

```text
Captured example-failure-001; accuracy 75%; failing cases: SW-004
Replayed example-failure-001; accuracy 75%; failing cases: SW-004
```

The Playwright suite checks the captured failure, rejects changed dataset or fixture bytes, detects altered observations, compares baseline and candidate outcomes by case ID, and attaches a JSON evidence bundle to the test result. HTML, JUnit, and JSON reports are written to `reports/`. View the HTML report with:

```bash
npm run test:report
```

## Interpret the evidence

Recorded-evidence replay proves that the saved observations and score are internally consistent with the exact dataset and fixture files used for capture. It does not prove that a model will return the same answer on a new request. The `simulator` model configuration, prompt version, evaluator version, and application revision are explicitly recorded in the manifest to demonstrate provenance; replace these with values from the real application when adapting the exercise.

The sample cases and ticket fixtures are synthetic. SHA-256 checksums identify exact file bytes; they do not establish that labels are correct, safe, or representative. Never include secrets or personal information in evaluation artifacts.
