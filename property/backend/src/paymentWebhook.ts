import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyWebhookSignature(rawBody: Buffer, signature: string | undefined, secret: string) {
  if (!signature) return false;
  const supplied = signature.replace(/^sha256=/, '').toLowerCase();
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  return supplied.length === expected.length && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}
