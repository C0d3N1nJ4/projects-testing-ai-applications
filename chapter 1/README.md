# Chapter 1 Companion Project

This project runs the chapter's repeated-prompt experiment against a local Ollama model. It sends the same VPN-support question eight times, records response text and latency, and reports a descriptive unique-string ratio. It does not automatically judge answer quality.

## Requirements

- Node.js 22 or newer and npm
- Ollama installed and serving its API locally

## Run the experiment

From the repository root:

```bash
cd "chapter 1"
npm install
npm run typecheck
ollama pull llama3.2:3b
npm run test:experiment
```

If Ollama is not already serving, start it in another terminal with `ollama serve`. The default endpoint is `http://127.0.0.1:11434`. Configure `OLLAMA_URL` to use a different endpoint. Select a model with `OLLAMA_MODEL` and a generation temperature with `TEMPERATURE`; defaults are `llama3.2:3b` and `0.8`.

For example, on POSIX shells:

```bash
TEMPERATURE=0 npm run test:experiment
TEMPERATURE=0.8 npm run test:experiment
TEMPERATURE=1.0 npm run test:experiment
```

Each run writes `results/variability-temp-<temperature>.json`. The artifact records the configured and returned model identifiers, question, policy, temperature, run count, response text, elapsed time, and unique response count. Re-running at the same temperature replaces that artifact, so archive or rename it before repeating if you need both runs.

## Interpret the results

The unique-string ratio is:

```text
unique response strings / total responses
```

It describes lexical variation only. It is not an accuracy score, failure probability, or standardized quality metric. Identical text can be wrong, and differently worded responses can be equally correct. A passing Playwright test only confirms that requests succeeded and nonempty outputs were collected.

Review every response using [the policy rubric](RUBRIC.md). Record pass, partial, or fail labels separately from the generated artifact. Check all required steps, password safety, and unsupported actions; do not rely on a keyword or diversity count to establish correctness.

## Reports

Playwright also writes an HTML report to `playwright-report/`. The generated output files, reports, and dependencies are ignored by Git because model responses are run-specific artifacts.