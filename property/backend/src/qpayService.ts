import { Buffer } from 'node:buffer';
import { getSecret } from './secrets.js';

type QpayToken = { accessToken: string; refreshToken?: string; expiresAt: number };
type FetchLike = typeof fetch;

export type QpayDeeplink = { name: string; description?: string; logo?: string; link: string };
export type QpayInvoiceResult = {
  invoiceId: string;
  senderInvoiceNo: string;
  amount: number;
  qrText?: string;
  qrImage?: string;
  shortUrl?: string;
  deeplinks: QpayDeeplink[];
  raw: unknown;
};

export type QpayInvoiceInput = {
  senderInvoiceNo: string;
  receiverCode: string;
  description: string;
  amount: number;
  callbackUrl?: string;
};

export type QpayPaymentCheckResult = {
  paid: boolean;
  paidAmount: number;
  paymentId?: string;
};

let cachedToken: QpayToken | null = null;

const qpayBaseUrl = () => (process.env.QPAY_BASE_URL ?? (process.env.NODE_ENV === 'production' ? 'https://merchant.qpay.mn' : 'https://merchant-sandbox.qpay.mn')).replace(/\/$/, '');

function env(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function tokenTtlSeconds(body: Record<string, unknown>) {
  const raw = body.expires_in ?? body.expiresIn ?? body.expire_in;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 3600;
}

async function readJson(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof body === 'object' && body && 'message' in body ? String(body.message) : `QPay request failed with ${response.status}.`);
  return body as Record<string, unknown>;
}

export async function getQpayAccessToken(fetchImpl: FetchLike = fetch) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.accessToken;
  const clientId = getSecret('QPAY_CLIENT_ID');
  const clientSecret = getSecret('QPAY_CLIENT_SECRET');
  const response = await fetchImpl(`${qpayBaseUrl()}/v2/auth/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`, 'Content-Type': 'application/json' },
  });
  const body = await readJson(response);
  const accessToken = typeof body.access_token === 'string' ? body.access_token : undefined;
  if (!accessToken) throw new Error('QPay token response did not include access_token.');
  cachedToken = {
    accessToken,
    refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : undefined,
    expiresAt: Date.now() + tokenTtlSeconds(body) * 1000,
  };
  return accessToken;
}

function normalizeInvoiceResponse(body: Record<string, unknown>, input: QpayInvoiceInput): QpayInvoiceResult {
  const links = Array.isArray(body.urls) ? body.urls : [];
  const deeplinks = links.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const link = 'link' in item && typeof item.link === 'string' ? item.link : undefined;
    if (!link) return [];
    return [{ name: 'name' in item && typeof item.name === 'string' ? item.name : 'Bank app', description: 'description' in item && typeof item.description === 'string' ? item.description : undefined, logo: 'logo' in item && typeof item.logo === 'string' ? item.logo : undefined, link }];
  });
  return {
    invoiceId: String(body.invoice_id ?? body.qpay_invoice_id ?? ''),
    senderInvoiceNo: input.senderInvoiceNo,
    amount: input.amount,
    qrText: typeof body.qr_text === 'string' ? body.qr_text : undefined,
    qrImage: typeof body.qr_image === 'string' ? body.qr_image : undefined,
    shortUrl: typeof body.qPay_shortUrl === 'string' ? body.qPay_shortUrl : typeof body.short_url === 'string' ? body.short_url : undefined,
    deeplinks,
    raw: body,
  };
}

export async function createQpayInvoice(input: QpayInvoiceInput, fetchImpl: FetchLike = fetch): Promise<QpayInvoiceResult> {
  const token = await getQpayAccessToken(fetchImpl);
  const response = await fetchImpl(`${qpayBaseUrl()}/v2/invoice`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      invoice_code: env('QPAY_INVOICE_CODE'),
      sender_invoice_no: input.senderInvoiceNo,
      invoice_receiver_code: input.receiverCode,
      invoice_description: input.description,
      amount: input.amount,
      callback_url: input.callbackUrl ?? env('QPAY_CALLBACK_URL', `${env('API_PUBLIC_URL', 'http://localhost:3001')}/api/v1/webhooks/payments/qpay`),
    }),
  });
  return normalizeInvoiceResponse(await readJson(response), input);
}

export async function checkQpayInvoicePayment(invoiceId: string, fetchImpl: FetchLike = fetch): Promise<QpayPaymentCheckResult> {
  const token = await getQpayAccessToken(fetchImpl);
  const response = await fetchImpl(`${qpayBaseUrl()}/v2/payment/check`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ object_type: 'INVOICE', object_id: invoiceId, offset: { page_number: 1, page_limit: 100 } }),
  });
  const body = await readJson(response);
  const rows = Array.isArray(body.rows) ? body.rows : [];
  const paidRows = rows.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object' && 'payment_status' in row && String(row.payment_status).toUpperCase() === 'PAID'));
  return {
    paid: paidRows.length > 0,
    paidAmount: paidRows.reduce((sum, row) => sum + Number(row.payment_amount ?? row.amount ?? 0), 0),
    paymentId: paidRows[0] ? String(paidRows[0].payment_id ?? '') || undefined : undefined,
  };
}

export function resetQpayTokenCacheForTests() {
  cachedToken = null;
}
