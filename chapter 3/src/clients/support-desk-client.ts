import type { APIRequestContext, APIResponse } from '@playwright/test';

export interface Ticket {
  id: string;
  category: string;
  status: string;
  summary: string;
}

export class SupportDeskClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly baseUrl: string
  ) {}

  health(): Promise<APIResponse> {
    return this.request.get(`${this.baseUrl}/health`);
  }

  getTicket(id: string): Promise<APIResponse> {
    return this.request.get(`${this.baseUrl}/tickets/${encodeURIComponent(id)}`);
  }
}