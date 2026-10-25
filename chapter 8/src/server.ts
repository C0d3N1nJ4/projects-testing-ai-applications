import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

type TicketStatus = 'OPEN' | 'RESOLVED';
type Ticket = {
  id: string;
  description: string;
  status: TicketStatus;
  version: number;
};
type Proposal = {
  id: string;
  ticketId: string;
  state: 'PENDING' | 'APPROVED' | 'EXECUTED';
};
type AuditEvent = {
  type: string;
  ticketId: string;
  proposalId?: string;
  role?: string;
  version?: number;
};

const tickets = new Map<string, Ticket>();
const proposals = new Map<string, Proposal>();
const audit: AuditEvent[] = [];
const executedProposals = new Set<string>();

function reset(): void {
  tickets.clear();
  proposals.clear();
  audit.length = 0;
  executedProposals.clear();
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function sendHtml(response: ServerResponse): void {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>AI Support Desk</title>
    <style>
      body { font: 16px system-ui, sans-serif; margin: 2rem auto; max-width: 46rem; padding: 0 1rem; }
      label, textarea, button { display: block; margin: .75rem 0; }
      textarea { box-sizing: border-box; width: 100%; min-height: 6rem; }
      button { padding: .5rem .8rem; }
      [hidden] { display: none !important; }
      .panel { border: 1px solid #bbb; border-radius: .4rem; margin-top: 1rem; padding: 1rem; }
      #error { color: #a00; }
    </style>
  </head>
  <body>
    <main>
      <h1>AI Support Desk</h1>
      <form id="ticket-form">
        <label for="description">Describe your issue</label>
        <textarea id="description" required></textarea>
        <button type="submit">Create ticket</button>
      </form>
      <p id="ticket-id" aria-live="polite"></p>
      <section id="workflow" hidden>
        <p id="state">Status: OPEN</p>
        <button id="guidance-button" type="button">Get AI guidance</button>
        <p id="guidance" aria-live="polite"></p>
        <button id="proposal-button" type="button">Request resolution approval</button>
        <p id="approval" aria-live="polite"></p>
        <button id="approve-button" type="button">Approve resolution</button>
        <button id="execute-button" type="button">Execute approved resolution</button>
        <p id="error" role="alert"></p>
      </section>
    </main>
    <script>
      const byId = id => document.getElementById(id);
      let ticketId;
      let proposalId;
      async function call(path, options = {}) {
        const response = await fetch(path, {
          ...options,
          headers: { 'content-type': 'application/json', ...(options.headers || {}) }
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Request failed');
        return body;
      }
      byId('ticket-form').addEventListener('submit', async event => {
        event.preventDefault();
        byId('error').textContent = '';
        try {
          const ticket = await call('/api/tickets', {
            method: 'POST',
            body: JSON.stringify({ description: byId('description').value })
          });
          ticketId = ticket.id;
          byId('ticket-id').textContent = 'Ticket: ' + ticketId;
          byId('state').textContent = 'Status: ' + ticket.status;
          byId('workflow').hidden = false;
        } catch (error) { byId('error').textContent = error.message; }
      });
      byId('guidance-button').addEventListener('click', async () => {
        try {
          const result = await call('/api/tickets/' + ticketId + '/guidance', { method: 'POST' });
          byId('guidance').textContent = result.guidance;
        } catch (error) { byId('error').textContent = error.message; }
      });
      byId('proposal-button').addEventListener('click', async () => {
        try {
          const proposal = await call('/api/tickets/' + ticketId + '/proposals', { method: 'POST' });
          proposalId = proposal.id;
          byId('approval').textContent = 'Approval pending';
        } catch (error) { byId('error').textContent = error.message; }
      });
      byId('approve-button').addEventListener('click', async () => {
        try {
          await call('/api/proposals/' + proposalId + '/approve', {
            method: 'POST', headers: { 'x-user-role': 'admin' }
          });
          byId('approval').textContent = 'Approval granted';
        } catch (error) { byId('error').textContent = error.message; }
      });
      byId('execute-button').addEventListener('click', async () => {
        try {
          const result = await call('/api/proposals/' + proposalId + '/execute', { method: 'POST' });
          byId('state').textContent = 'Status: ' + result.status;
        } catch (error) { byId('error').textContent = error.message; }
      });
    </script>
  </body>
</html>`);
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Request body must be a JSON object.');
  }
  return parsed as Record<string, unknown>;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  const method = request.method ?? 'GET';

  if (method === 'GET' && url.pathname === '/health') {
    send(response, 200, { status: 'ok' });
    return;
  }
  if (method === 'GET' && url.pathname === '/') {
    sendHtml(response);
    return;
  }
  if (method === 'POST' && url.pathname === '/api/reset') {
    reset();
    send(response, 200, { reset: true });
    return;
  }
  if (method === 'POST' && url.pathname === '/api/tickets') {
    try {
      const body = await readJson(request);
      if (typeof body.description !== 'string' || body.description.trim() === '') {
        send(response, 400, { error: 'description is required' });
        return;
      }
      const ticket: Ticket = {
        id: `T-${randomUUID()}`,
        description: body.description.trim(),
        status: 'OPEN',
        version: 1
      };
      tickets.set(ticket.id, ticket);
      send(response, 201, ticket);
    } catch (error) {
      send(response, 400, { error: error instanceof Error ? error.message : 'Invalid JSON' });
    }
    return;
  }
  if (method === 'GET' && url.pathname === '/api/audit') {
    send(response, 200, audit);
    return;
  }

  const ticketMatch = url.pathname.match(/^\/api\/tickets\/([^/]+)$/);
  if (method === 'GET' && ticketMatch) {
    const ticket = tickets.get(decodeURIComponent(ticketMatch[1]));
    send(response, ticket ? 200 : 404, ticket ?? { error: 'ticket not found' });
    return;
  }
  const guidanceMatch = url.pathname.match(/^\/api\/tickets\/([^/]+)\/guidance$/);
  if (method === 'POST' && guidanceMatch) {
    const ticketId = decodeURIComponent(guidanceMatch[1]);
    if (!tickets.has(ticketId)) {
      send(response, 404, { error: 'ticket not found' });
      return;
    }
    send(response, 200, {
      guidance: 'Check the VPN profile and reconnect. Obtain human approval before resolving this ticket.',
      model: 'deterministic-fixture',
      ticketId
    });
    return;
  }
  const proposalMatch = url.pathname.match(/^\/api\/tickets\/([^/]+)\/proposals$/);
  if (method === 'POST' && proposalMatch) {
    const ticketId = decodeURIComponent(proposalMatch[1]);
    const ticket = tickets.get(ticketId);
    if (!ticket) {
      send(response, 404, { error: 'ticket not found' });
      return;
    }
    audit.push({ type: 'tool.ticket.get', ticketId, version: ticket.version });
    const proposal: Proposal = {
      id: `P-${randomUUID()}`,
      ticketId,
      state: 'PENDING'
    };
    proposals.set(proposal.id, proposal);
    audit.push({ type: 'approval.requested', ticketId, proposalId: proposal.id });
    send(response, 201, proposal);
    return;
  }
  const proposalActionMatch = url.pathname.match(/^\/api\/proposals\/([^/]+)\/(approve|execute)$/);
  if (method === 'POST' && proposalActionMatch) {
    const proposal = proposals.get(decodeURIComponent(proposalActionMatch[1]));
    const action = proposalActionMatch[2];
    if (!proposal) {
      send(response, 404, { error: 'proposal not found' });
      return;
    }
    if (action === 'approve') {
      const role = request.headers['x-user-role'];
      if (role !== 'admin') {
        send(response, 403, { error: 'administrator approval required' });
        return;
      }
      if (proposal.state !== 'PENDING') {
        send(response, 409, { error: 'proposal is not pending' });
        return;
      }
      proposal.state = 'APPROVED';
      audit.push({ type: 'approval.granted', ticketId: proposal.ticketId, proposalId: proposal.id, role });
      send(response, 200, proposal);
      return;
    }

    if (proposal.state !== 'APPROVED' && proposal.state !== 'EXECUTED') {
      send(response, 403, { error: 'approved proposal required' });
      return;
    }
    if (!executedProposals.has(proposal.id)) {
      const ticket = tickets.get(proposal.ticketId);
      if (!ticket) {
        send(response, 404, { error: 'ticket not found' });
        return;
      }
      ticket.status = 'RESOLVED';
      ticket.version += 1;
      proposal.state = 'EXECUTED';
      executedProposals.add(proposal.id);
      audit.push({
        type: 'tool.ticket.update',
        ticketId: ticket.id,
        proposalId: proposal.id,
        version: ticket.version
      });
      send(response, 200, ticket);
      return;
    }
    const ticket = tickets.get(proposal.ticketId);
    if (!ticket) {
      send(response, 404, { error: 'ticket not found' });
      return;
    }
    send(response, 200, ticket);
    return;
  }

  send(response, 404, { error: 'not found' });
});

const port = Number(process.env.PORT ?? 4178);
server.listen(port, '127.0.0.1', () => {
  console.log(`AI Support Desk listening on http://127.0.0.1:${port}`);
});
