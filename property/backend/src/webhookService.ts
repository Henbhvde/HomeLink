import { createHmac } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { DataStore } from './dataStore.js';

export async function triggerWebhook(
  prisma: PrismaClient,
  store: DataStore,
  tenantId: string,
  event: string,
  payload: any
): Promise<void> {
  try {
    // 1. Get platform-tenants from storage key (which is used in index.ts for platform list)
    const tenantsList = await store.getScope<any[]>('platform-tenants') || [];
    // Fallback: check if we store tenants under the tenants key
    const tenant = tenantsList.find((t) => t.id === tenantId);
    if (tenant && tenant.plan !== 'Enterprise') {
      return; // Only Enterprise plan tenants can trigger webhooks
    }

    // 2. Retrieve tenant setting for webhook
    const settings = await store.getScope<any>(`${tenantId}:manager-settings`);
    if (!settings || !settings.webhookUrl) {
      return;
    }

    const payloadBody = JSON.stringify({
      event,
      tenantId,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (settings.webhookSecret) {
      const hmac = createHmac('sha256', settings.webhookSecret);
      hmac.update(payloadBody);
      headers['x-webhook-signature'] = hmac.digest('hex');
    }

    await fetch(settings.webhookUrl, {
      method: 'POST',
      headers,
      body: payloadBody,
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    // Suppress error so that it does not disrupt the main transaction
  }
}
