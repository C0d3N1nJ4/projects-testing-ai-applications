export type FailureKind =
  | 'unavailable'
  | 'rate_limited'
  | 'timeout'
  | 'malformed_output'
  | 'context_limit'
  | 'authorization';

export class DependencyError extends Error {
  constructor(
    readonly kind: FailureKind,
    message: string = kind,
    readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = 'DependencyError';
  }
}

export interface TextProvider {
  generate(prompt: string, signal?: AbortSignal): Promise<{ text: string }>;
}

export type ProviderStep =
  | { type: 'success'; value: string }
  | { type: 'failure'; kind: FailureKind; retryAfterMs?: number }
  | { type: 'hang' };

export class ScriptedProvider implements TextProvider {
  calls = 0;

  constructor(private readonly steps: ProviderStep[]) {}

  async generate(_prompt: string, signal?: AbortSignal): Promise<{ text: string }> {
    this.calls += 1;
    const step = this.steps.shift();
    if (!step) throw new Error('ScriptedProvider has no outcome for this call.');

    if (step.type === 'failure') {
      throw new DependencyError(step.kind, step.kind, step.retryAfterMs);
    }
    if (step.type === 'success') {
      return { text: step.value };
    }

    return new Promise((_, reject) => {
      const rejectOnAbort = () => {
        reject(new DependencyError('timeout', 'Provider call was aborted.'));
      };
      if (signal?.aborted) {
        rejectOnAbort();
        return;
      }
      signal?.addEventListener('abort', rejectOnAbort, { once: true });
    });
  }
}

export interface RetryPolicy {
  maxAttempts: number;
  timeoutMs: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export type ProviderTrace = {
  event: 'attempt' | 'retry' | 'timeout' | 'fallback' | 'failed' | 'succeeded';
  attempt: number;
  detail?: string;
  delayMs?: number;
};

export type GenerationResult =
  | { status: 'ok'; text: string; attempts: number; trace: ProviderTrace[] }
  | { status: 'fallback'; text: string; attempts: number; trace: ProviderTrace[] }
  | { status: 'failed'; reason: string; attempts: number; trace: ProviderTrace[] };

const retryableFailures = new Set<FailureKind>([
  'unavailable',
  'rate_limited',
  'timeout'
]);

const wait = (milliseconds: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

export async function generateReliably(
  provider: TextProvider,
  prompt: string,
  policy: RetryPolicy,
  sleep: (milliseconds: number) => Promise<void> = wait,
  fallback?: () => Promise<string>
): Promise<GenerationResult> {
  if (
    !Number.isInteger(policy.maxAttempts) ||
    policy.maxAttempts < 1 ||
    policy.timeoutMs <= 0 ||
    policy.baseDelayMs < 0 ||
    policy.maxDelayMs < 0
  ) {
    throw new RangeError('Retry policy requires positive attempts and timeout, with non-negative delays.');
  }

  const trace: ProviderTrace[] = [];

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    trace.push({ event: 'attempt', attempt });
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      const result = await Promise.race([
        provider.generate(prompt, controller.signal),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            controller.abort();
            reject(new DependencyError('timeout', 'Provider attempt timed out.'));
          }, policy.timeoutMs);
        })
      ]);
      trace.push({ event: 'succeeded', attempt });
      return { status: 'ok', text: result.text, attempts: attempt, trace };
    } catch (error) {
      const failure = error instanceof DependencyError
        ? error
        : new DependencyError('unavailable', error instanceof Error ? error.message : 'Provider failed.');
      if (failure.kind === 'timeout') {
        trace.push({ event: 'timeout', attempt });
      }

      if (!retryableFailures.has(failure.kind) || attempt === policy.maxAttempts) {
        const exhausted = retryableFailures.has(failure.kind);
        if (exhausted && fallback) {
          try {
            const text = await fallback();
            trace.push({ event: 'fallback', attempt, detail: failure.kind });
            return { status: 'fallback', text, attempts: attempt, trace };
          } catch (fallbackError) {
            const reason = fallbackError instanceof Error
              ? fallbackError.message
              : 'Fallback failed.';
            trace.push({ event: 'failed', attempt, detail: reason });
            return { status: 'failed', reason, attempts: attempt, trace };
          }
        }
        trace.push({ event: 'failed', attempt, detail: failure.kind });
        return {
          status: 'failed',
          reason: failure.kind,
          attempts: attempt,
          trace
        };
      }

      const backoff = Math.min(
        policy.maxDelayMs,
        policy.baseDelayMs * (2 ** (attempt - 1))
      );
      const delayMs = failure.kind === 'rate_limited' && failure.retryAfterMs !== undefined
        ? Math.max(backoff, Math.max(0, failure.retryAfterMs))
        : backoff;
      trace.push({ event: 'retry', attempt, detail: failure.kind, delayMs });
      await sleep(delayMs);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }

  throw new Error('Unreachable retry state.');
}

export interface Resolution {
  ticketId: string;
  action: 'RESOLVE';
  approvalId: string;
}

export function parseResolution(text: string): Resolution {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new DependencyError('malformed_output', 'Model output was not valid JSON.');
  }
  if (
    typeof value !== 'object' ||
    value === null ||
    !('ticketId' in value) ||
    typeof value.ticketId !== 'string' ||
    !('action' in value) ||
    value.action !== 'RESOLVE' ||
    !('approvalId' in value) ||
    typeof value.approvalId !== 'string'
  ) {
    throw new DependencyError('malformed_output', 'Model output did not match the resolution contract.');
  }
  return {
    ticketId: value.ticketId,
    action: 'RESOLVE',
    approvalId: value.approvalId
  };
}

export interface TicketApproval {
  ticketId: string;
  authorized: boolean;
  approved: boolean;
}

export interface Ticket {
  id: string;
  status: 'OPEN' | 'RESOLVED';
  version: number;
}

export type StoreTrace = {
  event: 'ticket.updated' | 'ticket.update_replayed' | 'policy.denied';
  operationId: string;
};

export class TicketStore {
  private readonly ticket: Ticket = { id: 'INC-101', status: 'OPEN', version: 1 };
  private readonly operations = new Map<string, { signature: string; ticket: Ticket }>();
  readonly trace: StoreTrace[] = [];
  effectiveUpdates = 0;

  get current(): Ticket {
    return { ...this.ticket };
  }

  update(
    approval: TicketApproval,
    operationId: string,
    loseAcknowledgement = false
  ): Ticket {
    if (!operationId) {
      this.trace.push({ event: 'policy.denied', operationId });
      throw new Error('OPERATION_ID_REQUIRED');
    }

    const signature = JSON.stringify(approval);
    const previous = this.operations.get(operationId);
    if (previous) {
      if (previous.signature !== signature) {
        this.trace.push({ event: 'policy.denied', operationId });
        throw new Error('OPERATION_ID_REUSED');
      }
      this.trace.push({ event: 'ticket.update_replayed', operationId });
      return { ...previous.ticket };
    }

    if (
      !approval.authorized ||
      !approval.approved ||
      approval.ticketId !== this.ticket.id
    ) {
      this.trace.push({ event: 'policy.denied', operationId });
      throw new DependencyError('authorization', 'A valid authorized approval is required.');
    }

    this.ticket.status = 'RESOLVED';
    this.ticket.version += 1;
    this.effectiveUpdates += 1;
    this.operations.set(operationId, {
      signature,
      ticket: { ...this.ticket }
    });
    this.trace.push({ event: 'ticket.updated', operationId });

    if (loseAcknowledgement) {
      throw new DependencyError('timeout', 'Update committed but acknowledgement was lost.');
    }
    return { ...this.ticket };
  }
}
