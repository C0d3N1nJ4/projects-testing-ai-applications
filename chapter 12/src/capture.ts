import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createBundle, readProjectInputs } from './evaluation';

function main(): void {
  const projectRoot = resolve(__dirname, '..');
  const destination = join(projectRoot, 'artifacts', 'recorded-failure', 'bundle.json');
  if (existsSync(destination)) {
    throw new Error(
      `Refusing to overwrite ${destination}. Archive the existing bundle before a new capture.`
    );
  }

  const inputs = readProjectInputs(projectRoot);
  const bundle = createBundle(inputs, {
    appRevision: process.env.APP_REVISION ?? 'local-simulator-v1'
  });
  mkdirSync(join(projectRoot, 'artifacts', 'recorded-failure'), { recursive: true });
  writeFileSync(destination, `${JSON.stringify(bundle, null, 2)}\n`, { flag: 'wx' });
  const failingCases = bundle.score.failingCaseIds.join(', ') || 'none';
  console.log(
    `Captured ${bundle.manifest.runId}; accuracy ${bundle.score.accuracy * 100}%; ` +
    `failing cases: ${failingCases}`
  );
}

try {
  main();
} catch (error) {
  console.error(`Capture failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
