import { createHmac, timingSafeEqual } from 'node:crypto';
import { getSecret } from './secrets.js';

type FetchLike = typeof fetch;

export type StripeCheckoutSession = {
  id: string;
  url?: string;
  paymentStatus: string;
  amountTotal: number;
  clientReferenceId?: string;
  paymentIntentId?: string;
};

const stripeBaseUrl = () => (process.env.STRIPE_API_BASE_URL ?? 'https://api.stripe.com').replace(/\/$/, '');

function stripeSecret() {
  const value = getSecret('STRIPE_SECRET_KEY');
  if (!value.startsWith('sk_test_')) throw new Error('Stripe test secret key (sk_test_...) is required.');
  return value;
}

async function readSession(response: Response): Promise<StripeCheckoutSession> {
  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !body) {
    const stripeError = body?.error && typeof body.error === 'object' && 'message' in body.error ? String(body.error.message) : 'Stripe request failed.';
    throw new Error(stripeError);
  }
  return {
    id: String(body.id ?? ''),
    url: typeof body.url === 'string' ? body.url : undefined,
    paymentStatus: String(body.payment_status ?? 'unpaid'),
    amountTotal: Number(body.amount_total ?? 0),
    clientReferenceId: typeof body.client_reference_id === 'string' ? body.client_reference_id : undefined,
    paymentIntentId: typeof body.payment_intent === 'string' ? body.payment_intent : undefined,
  };
}

export async function createStripeCheckout(input: { tenantId: string; email: string; plan: string; amountMnt: number; successUrl: string; cancelUrl: string }, fetchImpl: FetchLike = fetch) {
  const form = new URLSearchParams({
    mode: 'payment',
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.tenantId,
    customer_email: input.email,
    'metadata[tenant_id]': input.tenantId,
    'payment_method_types[0]': 'card',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'mnt',
    'line_items[0][price_data][unit_amount]': String(input.amountMnt * 100),
    'line_items[0][price_data][product_data][name]': `HomeLink ${input.plan} багц - 1 сар`,
  });
  return readSession(await fetchImpl(`${stripeBaseUrl()}/v1/checkout/sessions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${stripeSecret()}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  }));
}

export async function getStripeCheckout(sessionId: string, fetchImpl: FetchLike = fetch) {
  return readSession(await fetchImpl(`${stripeBaseUrl()}/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${stripeSecret()}` },
  }));
}

export function verifyStripeWebhook(rawBody: Buffer, signatureHeader: string | undefined, now = Date.now()) {
  if (!signatureHeader) throw new Error('Stripe signature is missing.');
  const parts = signatureHeader.split(',').map((part) => part.split('=', 2));
  const timestamp = parts.find(([key]) => key === 't')?.[1];
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!timestamp || signatures.length === 0 || Math.abs(now / 1000 - Number(timestamp)) > 300) throw new Error('Stripe signature is invalid or expired.');
  const expected = createHmac('sha256', getSecret('STRIPE_WEBHOOK_SECRET')).update(`${timestamp}.`).update(rawBody).digest('hex');
  const valid = signatures.some((value) => value.length === expected.length && timingSafeEqual(Buffer.from(value), Buffer.from(expected)));
  if (!valid) throw new Error('Stripe signature verification failed.');
  return JSON.parse(rawBody.toString('utf8')) as { id: string; type: string; data?: { object?: Record<string, unknown> } };
}
