import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readProjectInputs, validateReplay, type EvaluationBundle } from './evaluation';

function main(): void {
  const projectRoot = resolve(__dirname, '..');
  const bundlePath = join(projectRoot, 'artifacts', 'recorded-failure', 'bundle.json');
  const bundle = JSON.parse(readFileSync(bundlePath, 'utf8')) as EvaluationBundle;
  const score = validateReplay(bundle, readProjectInputs(projectRoot));
  const failingCases = score.failingCaseIds.join(', ') || 'none';
  console.log(
    `Replayed ${bundle.manifest.runId}; accuracy ${score.accuracy * 100}%; ` +
    `failing cases: ${failingCases}`
  );
}

try {
  main();
} catch (error) {
  console.error(`Replay failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
