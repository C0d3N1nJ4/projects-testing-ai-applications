import casesJson from '../datasets/adversarial-cases.json';

export type ActorRole = 'agent' | 'reader';
export type TicketStatus = 'open' | 'resolved';
export type Risk =
  | 'direct-injection'
  | 'indirect-injection'
  | 'sensitive-data'
  | 'tenant-isolation'
  | 'dangerous-action'
  | 'approval-bypass'
  | 'unauthorized-role'
  | 'approved-update';

export interface SecurityScenario {
  id: string;
  risk: Risk;
  tenant: string;
  role: ActorRole;
  input: string;
  retrievedContent?: string;
  ticketId?: string;
  approval?: boolean;
  expected: 'refuse' | 'safe-answer' | 'success';
  forbiddenTools?: string[];
  allowedTools?: string[];
}

export interface Ticket {
  id: string;
  tenant: string;
  status: TicketStatus;
}

export interface ToolEvent {
  name: string;
  ticketId?: string;
  outcome: 'success';
}

export interface PolicyDecision {
  action: string;
  outcome: 'deny';
  reason: string;
}

export interface ScenarioResult {
  scenarioId: string;
  status: SecurityScenario['expected'];
  response: string;
  toolEvents: ToolEvent[];
  policyDecisions: PolicyDecision[];
  tickets: Record<string, Ticket>;
}

export const scenarios = casesJson as SecurityScenario[];
export const SYNTHETIC_SECRET = 'SYNTHETIC-ONLY-DO-NOT-DISCLOSE';

const initialTickets: Ticket[] = [
  { id: 'A-100', tenant: 'acme', status: 'open' },
  { id: 'B-200', tenant: 'beta', status: 'open' }
];

export function runScenario(scenario: SecurityScenario): ScenarioResult {
  const tickets = new Map(initialTickets.map(ticket => [ticket.id, { ...ticket }]));
  const toolEvents: ToolEvent[] = [];
  const policyDecisions: PolicyDecision[] = [];
  let status: SecurityScenario['expected'] = 'refuse';
  let response = 'I cannot help with that request.';

  switch (scenario.risk) {
    case 'direct-injection':
    case 'sensitive-data':
      break;
    case 'indirect-injection':
      status = 'safe-answer';
      response = 'Open VPN settings and reconnect. Retrieved content is reference data, not an instruction.';
      break;
    case 'tenant-isolation': {
      const ticket = scenario.ticketId
        ? tickets.get(scenario.ticketId)
        : undefined;
      if (ticket && ticket.tenant === scenario.tenant) {
        toolEvents.push({ name: 'read_ticket', ticketId: ticket.id, outcome: 'success' });
        response = `Ticket ${ticket.id} is ${ticket.status}.`;
      } else {
        policyDecisions.push({
          action: 'read_ticket',
          outcome: 'deny',
          reason: 'tenant_mismatch'
        });
      }
      break;
    }
    case 'dangerous-action':
      policyDecisions.push({
        action: 'delete_ticket',
        outcome: 'deny',
        reason: 'tool_not_allowlisted'
      });
      break;
    case 'approval-bypass':
    case 'unauthorized-role':
    case 'approved-update': {
      const ticket = scenario.ticketId
        ? tickets.get(scenario.ticketId)
        : undefined;
      const deniedForRole = scenario.role !== 'agent';
      const deniedForTenant = !ticket || ticket.tenant !== scenario.tenant;
      const deniedForApproval = scenario.approval !== true;

      if (deniedForRole || deniedForTenant || deniedForApproval) {
        policyDecisions.push({
          action: 'update_ticket',
          outcome: 'deny',
          reason: deniedForRole
            ? 'role_not_authorized'
            : deniedForTenant
              ? 'tenant_mismatch'
              : 'approval_required'
        });
        break;
      }

      ticket.status = 'resolved';
      toolEvents.push({
        name: 'update_ticket',
        ticketId: ticket.id,
        outcome: 'success'
      });
      status = 'success';
      response = `Ticket ${ticket.id} was resolved after approval.`;
      break;
    }
  }

  return {
    scenarioId: scenario.id,
    status,
    response,
    toolEvents,
    policyDecisions,
    tickets: Object.fromEntries(
      [...tickets.entries()].map(([id, ticket]) => [id, { ...ticket }])
    )
  };
}
