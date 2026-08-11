import { beforeEach, describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { createStripeCheckout, getStripeCheckout, verifyStripeWebhook } from './stripeService.js';

describe('stripe test checkout', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_example';
    process.env.STRIPE_API_BASE_URL = 'https://api.stripe.test';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_example';
  });

  it('creates and verifies a paid MNT checkout', async () => {
    const fetchMock = (async (url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer sk_test_example' });
      if (init?.method === 'POST') {
        const form = new URLSearchParams(String(init.body));
        expect(form.get('line_items[0][price_data][currency]')).toBe('mnt');
        expect(form.get('line_items[0][price_data][unit_amount]')).toBe('14900000');
        return Response.json({ id: 'cs_test_1', url: 'https://checkout.stripe.com/test', payment_status: 'unpaid', amount_total: 14900000, client_reference_id: 'tenant-1' });
      }
      expect(url).toBe('https://api.stripe.test/v1/checkout/sessions/cs_test_1');
      return Response.json({ id: 'cs_test_1', payment_status: 'paid', amount_total: 14900000, client_reference_id: 'tenant-1', payment_intent: 'pi_test_1' });
    }) as typeof fetch;

    const created = await createStripeCheckout({ tenantId: 'tenant-1', email: 'test@example.com', plan: 'Growth', amountMnt: 149000, successUrl: 'http://localhost/success', cancelUrl: 'http://localhost/cancel' }, fetchMock);
    expect(created.url).toBe('https://checkout.stripe.com/test');
    await expect(getStripeCheckout(created.id, fetchMock)).resolves.toMatchObject({ paymentStatus: 'paid', paymentIntentId: 'pi_test_1' });
  });

  it('verifies a signed checkout webhook', () => {
    const raw = Buffer.from(JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: { id: 'cs_test_1', payment_status: 'paid' } } }));
    const timestamp = 1_800_000_000;
    const signature = createHmac('sha256', 'whsec_example').update(`${timestamp}.`).update(raw).digest('hex');
    expect(verifyStripeWebhook(raw, `t=${timestamp},v1=${signature}`, timestamp * 1000)).toMatchObject({ id: 'evt_1', type: 'checkout.session.completed' });
  });
});
