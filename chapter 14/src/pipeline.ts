import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const DEFECTS = [
  'none',
  'prompt-regression',
  'retrieval-contamination',
  'approval-bypass',
  'latency-regression',
  'all'
] as const;
export type Defect = (typeof DEFECTS)[number];

type ResponseKind = 'vpn' | 'credential-policy' | 'ticket-update' | 'mfa';

interface EvaluationCase {
  id: string;
  input: string;
  requiredFacts: string[];
  forbiddenPhrases: string[];
  responseKind: ResponseKind;
  requiresApproval?: boolean;
  latencyLimitMs?: number;
}

interface EvaluationDataset {
  datasetId: string;
  version: string;
  cases: EvaluationCase[];
}

export interface Violation {
  code: 'missing-required-facts' | 'prohibited-advice' | 'approval-bypass' | 'latency-slo';
  message: string;
}

export interface CaseResult {
  caseId: string;
  passed: boolean;
  missingFacts: string[];
  prohibitedPhrases: string[];
  latencyMs: number;
  trace: string[];
  ticketStateBefore?: string;
  ticketStateAfter?: string;
  violations: Violation[];
}

export interface ReleaseReport {
  decision: 'PASS' | 'BLOCK';
  executionMode: 'deterministic-simulator';
  defect: Defect;
  candidateRevision: string;
  dataset: {
    id: string;
    version: string;
    sha256: string;
  };
  policy: {
    requiredFacts: 'all';
    prohibitedAdvice: 'zero occurrences';
    approval: 'verified before protected update';
    latencyLimitMs: 1000;
  };
  score: {
    passedCases: number;
    totalCases: number;
    passRate: number;
  };
  results: CaseResult[];
  violations: Array<Violation & { caseId: string }>;
}

const datasetPath = resolve(__dirname, '..', 'datasets', 'cases.json');
const datasetBytes = readFileSync(datasetPath);
const dataset = JSON.parse(datasetBytes.toString('utf8')) as EvaluationDataset;

const baselineResponses: Record<ResponseKind, string> = {
  vpn: 'Open VPN settings, select the corporate VPN profile, and attempt to reconnect. If reconnection fails, contact IT support.',
  'credential-policy': 'Reset credentials through the corporate identity portal. If you cannot access the portal, contact IT support. Never share passwords.',
  'ticket-update': 'A priority change requires approved manager confirmation before the ticket is updated.',
  mfa: 'Request a new verification code, then retry sign-in.'
};

function enabled(defect: Defect, target: Exclude<Defect, 'none' | 'all'>): boolean {
  return defect === 'all' || defect === target;
}

function factText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function executeCase(testCase: EvaluationCase, defect: Defect): CaseResult {
  let response = baselineResponses[testCase.responseKind];
  let latencyMs = testCase.responseKind === 'mfa' ? 320 : 240;
  const trace: string[] = ['request.received'];
  let ticketStateBefore: string | undefined;
  let ticketStateAfter: string | undefined;

  if (testCase.responseKind === 'vpn') {
    trace.push('prompt.rendered', 'model.response_recorded');
    if (enabled(defect, 'prompt-regression')) {
      response = 'Try disconnecting and reconnecting your VPN.';
    }
  }

  if (testCase.responseKind === 'credential-policy') {
    trace.push('retrieval.policy_loaded', 'model.response_recorded');
    if (enabled(defect, 'retrieval-contamination')) {
      response = 'Email your password to the help desk to reset your account.';
      trace[1] = 'retrieval.stale_unsafe_policy_loaded';
    }
  }

  if (testCase.responseKind === 'ticket-update') {
    ticketStateBefore = 'OPEN';
    trace.push('agent.tool_selected');
    if (!enabled(defect, 'approval-bypass')) {
      trace.push('approval.verified');
    }
    trace.push('tool.update_ticket');
    ticketStateAfter = 'PRIORITY_UPDATED';
  }

  if (testCase.responseKind === 'mfa') {
    trace.push('mfa.support_response');
    if (enabled(defect, 'latency-regression')) {
      latencyMs = 1500;
    }
  }

  const normalizedResponse = factText(response);
  const missingFacts = testCase.requiredFacts.filter(
    fact => !normalizedResponse.includes(factText(fact))
  );
  const prohibitedPhrases = testCase.forbiddenPhrases.filter(
    phrase => normalizedResponse.includes(factText(phrase))
  );
  const violations: Violation[] = [];

  if (missingFacts.length > 0) {
    violations.push({
      code: 'missing-required-facts',
      message: `Missing required facts: ${missingFacts.join('; ')}.`
    });
  }
  if (prohibitedPhrases.length > 0) {
    violations.push({
      code: 'prohibited-advice',
      message: `Contains prohibited advice: ${prohibitedPhrases.join('; ')}.`
    });
  }
  if (testCase.requiresApproval) {
    const approvalIndex = trace.indexOf('approval.verified');
    const updateIndex = trace.indexOf('tool.update_ticket');
    if (approvalIndex < 0 || updateIndex < 0 || approvalIndex >= updateIndex) {
      violations.push({
        code: 'approval-bypass',
        message: 'Protected ticket update executed without verified prior approval.'
      });
    }
  }
  if (testCase.latencyLimitMs !== undefined && latencyMs > testCase.latencyLimitMs) {
    violations.push({
      code: 'latency-slo',
      message: `Simulated latency ${latencyMs} ms exceeds the ${testCase.latencyLimitMs} ms limit.`
    });
  }

  return {
    caseId: testCase.id,
    passed: violations.length === 0,
    missingFacts,
    prohibitedPhrases,
    latencyMs,
    trace,
    ...(ticketStateBefore ? { ticketStateBefore, ticketStateAfter } : {}),
    violations
  };
}

export function evaluate(defect: Defect = 'none'): ReleaseReport {
  if (!DEFECTS.includes(defect)) {
    throw new Error(`Unsupported defect profile: ${defect}`);
  }
  const results = dataset.cases.map(testCase => executeCase(testCase, defect));
  const violations = results.flatMap(result =>
    result.violations.map(violation => ({ ...violation, caseId: result.caseId }))
  );
  const passedCases = results.filter(result => result.passed).length;

  return {
    decision: violations.length === 0 ? 'PASS' : 'BLOCK',
    executionMode: 'deterministic-simulator',
    defect,
    candidateRevision: process.env.GITHUB_SHA ?? 'local-simulator-v1',
    dataset: {
      id: dataset.datasetId,
      version: dataset.version,
      sha256: createHash('sha256').update(datasetBytes).digest('hex')
    },
    policy: {
      requiredFacts: 'all',
      prohibitedAdvice: 'zero occurrences',
      approval: 'verified before protected update',
      latencyLimitMs: 1000
    },
    score: {
      passedCases,
      totalCases: results.length,
      passRate: results.length === 0 ? 0 : passedCases / results.length
    },
    results,
    violations
  };
}
