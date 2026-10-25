export type Actor = {
  id: string;
  role: 'VIEWER' | 'OPERATOR';
  tenant: string;
};

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
export type ApprovalDecision = 'APPROVED' | 'REJECTED';

export type Ticket = {
  id: string;
  tenant: string;
  priority: Priority;
  version: number;
};

export type Approval = {
  id: string;
  actorId: string;
  ticketId: string;
  priority: Priority;
  expectedVersion: number;
  state: 'PENDING' | ApprovalDecision;
  expiresAt: number;
};

export type TraceEvent = {
  type:
    | 'ticket.read'
    | 'approval.requested'
    | 'approval.decided'
    | 'ticket.updated'
    | 'ticket.update_replayed'
    | 'policy.denied';
  details: Record<string, string | number | boolean>;
};

export class AgentHarness {
  readonly trace: TraceEvent[] = [];
  failNextUpdate = false;

  private readonly tickets = new Map<string, Ticket>();
  private readonly approvals = new Map<string, Approval>();
  private readonly idempotency = new Map<string, { signature: string; ticket: Ticket }>();
  private nextApprovalId = 1;

  constructor(
    tickets: Ticket[] = [
      { id: 'T-123', tenant: 'acme', priority: 'LOW', version: 1 }
    ],
    private readonly now: () => number = Date.now
  ) {
    for (const ticket of tickets) {
      this.tickets.set(ticket.id, { ...ticket });
    }
  }

  getTicket(actor: Actor, ticketId: string): Ticket {
    const ticket = this.tickets.get(ticketId);
    if (!ticket || ticket.tenant !== actor.tenant) {
      this.deny('ticket.read', actor, ticketId);
      throw new Error('ACCESS_DENIED');
    }

    this.trace.push({
      type: 'ticket.read',
      details: { actorId: actor.id, ticketId, version: ticket.version }
    });
    return { ...ticket };
  }

  requestApproval(actor: Actor, ticketId: string, priority: Priority): Approval {
    if (actor.role !== 'OPERATOR') {
      this.deny('approval.requested', actor, ticketId);
      throw new Error('ACCESS_DENIED');
    }

    const ticket = this.getTicket(actor, ticketId);
    const approval: Approval = {
      id: `approval-${this.nextApprovalId++}`,
      actorId: actor.id,
      ticketId,
      priority,
      expectedVersion: ticket.version,
      state: 'PENDING',
      expiresAt: this.now() + 60_000
    };
    this.approvals.set(approval.id, approval);
    this.trace.push({
      type: 'approval.requested',
      details: {
        approvalId: approval.id,
        actorId: actor.id,
        ticketId,
        priority,
        expectedVersion: ticket.version
      }
    });
    return { ...approval };
  }

  decide(approvalId: string, decision: ApprovalDecision): void {
    const approval = this.approvals.get(approvalId);
    if (!approval || approval.state !== 'PENDING') {
      throw new Error('APPROVAL_NOT_PENDING');
    }

    approval.state = decision;
    this.trace.push({
      type: 'approval.decided',
      details: { approvalId, decision }
    });
  }

  update(
    actor: Actor,
    ticketId: string,
    priority: Priority,
    approvalId: string,
    idempotencyKey: string
  ): Ticket {
    const signature = JSON.stringify({
      actorId: actor.id,
      ticketId,
      priority,
      approvalId
    });
    const previous = this.idempotency.get(idempotencyKey);
    if (previous) {
      if (previous.signature !== signature) {
        this.deny('ticket.updated', actor, ticketId);
        throw new Error('IDEMPOTENCY_KEY_REUSED');
      }
      this.trace.push({
        type: 'ticket.update_replayed',
        details: { ticketId, idempotencyKey }
      });
      return { ...previous.ticket };
    }

    if (!idempotencyKey) {
      this.deny('ticket.updated', actor, ticketId);
      throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    }

    const ticket = this.tickets.get(ticketId);
    if (!ticket || ticket.tenant !== actor.tenant || actor.role !== 'OPERATOR') {
      this.deny('ticket.updated', actor, ticketId);
      throw new Error('ACCESS_DENIED');
    }

    const approval = this.approvals.get(approvalId);
    if (!approval || approval.state !== 'APPROVED') {
      this.deny('ticket.updated', actor, ticketId);
      throw new Error('APPROVAL_REQUIRED');
    }
    if (
      approval.actorId !== actor.id ||
      approval.ticketId !== ticketId ||
      approval.priority !== priority
    ) {
      this.deny('ticket.updated', actor, ticketId);
      throw new Error('APPROVAL_MISMATCH');
    }
    if (approval.expiresAt <= this.now()) {
      this.deny('ticket.updated', actor, ticketId);
      throw new Error('APPROVAL_EXPIRED');
    }
    if (approval.expectedVersion !== ticket.version) {
      this.deny('ticket.updated', actor, ticketId);
      throw new Error('VERSION_CONFLICT');
    }

    if (this.failNextUpdate) {
      this.failNextUpdate = false;
      throw new Error('TRANSIENT_FAILURE');
    }

    ticket.priority = priority;
    ticket.version += 1;
    this.idempotency.set(idempotencyKey, { signature, ticket: { ...ticket } });
    this.trace.push({
      type: 'ticket.updated',
      details: { ticketId, priority, version: ticket.version, idempotencyKey }
    });
    return { ...ticket };
  }

  private deny(operation: string, actor: Actor, ticketId: string): void {
    this.trace.push({
      type: 'policy.denied',
      details: { operation, actorId: actor.id, ticketId }
    });
  }
}
