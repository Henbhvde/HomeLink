import { beforeEach, describe, expect, it } from 'vitest';
import { checkQpayInvoicePayment, createQpayInvoice, resetQpayTokenCacheForTests } from './qpayService.js';

describe('qpay service', () => {
  beforeEach(() => {
    resetQpayTokenCacheForTests();
    process.env.QPAY_CLIENT_ID = 'client';
    process.env.QPAY_CLIENT_SECRET = 'secret';
    process.env.QPAY_INVOICE_CODE = 'INV_CODE';
    process.env.QPAY_BASE_URL = 'https://merchant-sandbox.qpay.mn';
    process.env.API_PUBLIC_URL = 'https://api.example.test';
  });

  it('creates invoice and reuses access token', async () => {
    const calls: string[] = [];
    const invoiceBodies: Array<Record<string, unknown>> = [];
    const fetchMock = (async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.endsWith('/v2/auth/token')) return Response.json({ access_token: 'token-1', expires_in: 3600 });
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer token-1' });
      const body = JSON.parse(String(init?.body));
      invoiceBodies.push(body);
      return Response.json({ invoice_id: 'qpay-1', qr_text: 'qr', qPay_shortUrl: 'https://qpay.mn/i/qpay-1', urls: [{ name: 'Khan Bank', link: 'khanbank://pay' }] });
    }) as typeof fetch;

    const first = await createQpayInvoice({ senderInvoiceNo: 'S-1', receiverCode: 'tenant-1', description: 'Invoice', amount: 110000 }, fetchMock);
    const second = await createQpayInvoice({ senderInvoiceNo: 'S-2', receiverCode: 'tenant-1', description: 'Invoice 2', amount: 120000 }, fetchMock);

    expect(first).toMatchObject({ invoiceId: 'qpay-1', qrText: 'qr', shortUrl: 'https://qpay.mn/i/qpay-1', deeplinks: [{ name: 'Khan Bank', link: 'khanbank://pay' }] });
    expect(second.invoiceId).toBe('qpay-1');
    expect(invoiceBodies[0]).toMatchObject({ invoice_code: 'INV_CODE', sender_invoice_no: 'S-1', amount: 110000, callback_url: 'https://api.example.test/api/v1/webhooks/payments/qpay' });
    expect(invoiceBodies[1]).toMatchObject({ sender_invoice_no: 'S-2', amount: 120000 });
    expect(calls.filter((call) => call.endsWith('/v2/auth/token'))).toHaveLength(1);
  });

  it('confirms a paid invoice', async () => {
    const fetchMock = (async (url: string, init?: RequestInit) => {
      if (url.endsWith('/v2/auth/token')) return Response.json({ access_token: 'token-1', expires_in: 3600 });
      expect(url).toBe('https://merchant-sandbox.qpay.mn/v2/payment/check');
      expect(JSON.parse(String(init?.body))).toMatchObject({ object_type: 'INVOICE', object_id: 'qpay-1' });
      return Response.json({ rows: [{ payment_id: 'payment-1', payment_status: 'PAID', payment_amount: 149000 }] });
    }) as typeof fetch;

    await expect(checkQpayInvoicePayment('qpay-1', fetchMock)).resolves.toEqual({ paid: true, paidAmount: 149000, paymentId: 'payment-1' });
  });
});
