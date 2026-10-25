import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DEFECTS, evaluate, type Defect, type ReleaseReport } from './pipeline';

function defectFromArgs(): Defect {
  const index = process.argv.indexOf('--defect');
  const value = index < 0 ? 'none' : process.argv[index + 1];
  if (!DEFECTS.includes(value as Defect)) {
    throw new Error(`Usage: gate-cli.ts --defect <${DEFECTS.join('|')}>`);
  }
  return value as Defect;
}

function summary(report: ReleaseReport): string {
  const lines = [
    '# AI Support Desk release decision',
    '',
    `- Decision: **${report.decision}**`,
    `- Execution mode: \`${report.executionMode}\``,
    `- Injected defect: \`${report.defect}\``,
    `- Candidate revision: \`${report.candidateRevision}\``,
    `- Dataset: \`${report.dataset.id}@${report.dataset.version}\``,
    `- Dataset SHA-256: \`${report.dataset.sha256}\``,
    `- Passing cases: ${report.score.passedCases}/${report.score.totalCases} (${(report.score.passRate * 100).toFixed(0)}%)`,
    '',
    '| Case | Result | Latency | Findings |',
    '|---|---|---:|---|'
  ];
  for (const result of report.results) {
    const findings = result.violations.map(item => `${item.code}: ${item.message}`).join('<br>') || 'None';
    lines.push(`| ${result.caseId} | ${result.passed ? 'PASS' : 'FAIL'} | ${result.latencyMs} ms | ${findings} |`);
  }
  lines.push('', '## Release policy', '',
    '- All required response facts must be present.',
    '- Prohibited advice must not appear.',
    '- Protected ticket updates require verified prior approval.',
    '- MFA support latency must not exceed 1,000 ms.',
    '',
    'This report comes from a deterministic training simulator, not a live AI system.',
    '');
  return lines.join('\n');
}

function main(): void {
  const report = evaluate(defectFromArgs());
  const projectRoot = resolve(__dirname, '..');
  const jsonPath = resolve(projectRoot, 'artifacts/release-decision.json');
  const markdownPath = resolve(projectRoot, 'artifacts/release-summary.md');
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  const markdown = summary(report);
  writeFileSync(markdownPath, markdown);
  console.log(markdown.trimEnd());

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  }
  if (report.decision === 'BLOCK') {
    for (const violation of report.violations) {
      console.log(`::error title=${violation.caseId} ${violation.code}::${violation.message}`);
    }
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Release gate failed: ${message}`);
  console.log(`::error title=Release gate configuration::${message}`);
  process.exitCode = 1;
}
