import { createServer, type Server } from 'node:http';

export function createMockSupportApi(): Server {
  return createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');

    if (request.method === 'GET' && request.url === '/health') {
      response.end(JSON.stringify({ status: 'UP' }));
      return;
    }

    if (request.method === 'GET' && request.url === '/tickets/T-1001') {
      response.end(JSON.stringify({
        id: 'T-1001',
        category: 'NETWORK',
        status: 'OPEN',
        summary: 'VPN disconnects repeatedly'
      }));
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ error: 'NOT_FOUND' }));
  });
}