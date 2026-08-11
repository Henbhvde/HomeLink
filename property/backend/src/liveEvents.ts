import type { Response } from 'express';
import type { AuthTokenPayload } from './auth.js';

export type LiveEvent = {
  type: 'notification.created' | 'payment.updated';
  tenantId: string;
  userId?: string;
  data: Record<string, unknown>;
};

const clients = new Set<{ auth: AuthTokenPayload; response: Response }>();
export const canReceiveLiveEvent = (auth: AuthTokenPayload, event: LiveEvent) =>
  auth.tenantId === event.tenantId && (!event.userId || auth.sub === event.userId);

export function subscribeToLiveEvents(auth: AuthTokenPayload, response: Response) {
  const client = { auth, response };
  clients.add(client);
  response.write(`event: connected\ndata: ${JSON.stringify({ connected: true })}\n\n`);
  return () => clients.delete(client);
}

export function publishLiveEvent(event: LiveEvent) {
  const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
  for (const client of clients) if (canReceiveLiveEvent(client.auth, event)) client.response.write(payload);
}
