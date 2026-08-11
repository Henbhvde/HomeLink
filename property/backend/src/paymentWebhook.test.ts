import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyWebhookSignature } from './paymentWebhook.js';

describe('payment webhook signature', () => {
  it('accepts the exact HMAC and rejects tampering', () => {
    const body = Buffer.from('{"amount":100}'); const secret = 'webhook-secret';
    const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
    expect(verifyWebhookSignature(body, signature, secret)).toBe(true);
    expect(verifyWebhookSignature(Buffer.from('{"amount":101}'), signature, secret)).toBe(false);
  });
});
