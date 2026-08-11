import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getSecret } from './secrets.js';

export const oauthCookieName = 'homelink_oauth';
type Flow = { state: string; nonce: string; verifier: string; redirectUri: string; expiresAt: number };
const secret = () => { const value = getSecret('JWT_SECRET'); if (value.length < 32) throw new Error('JWT_SECRET is required.'); return value; };
const sign = (value: string) => createHmac('sha256', secret()).update(value).digest('base64url');

export function createOAuthFlow(redirectUri: string) {
  const flow: Flow = { state: randomBytes(32).toString('base64url'), nonce: randomBytes(32).toString('base64url'), verifier: randomBytes(48).toString('base64url'), redirectUri, expiresAt: Date.now() + 10 * 60_000 };
  const payload = Buffer.from(JSON.stringify(flow)).toString('base64url');
  return { ...flow, challenge: createHash('sha256').update(flow.verifier).digest('base64url'), cookie: `${payload}.${sign(payload)}` };
}

export function verifyOAuthFlow(cookie: string | null, state: string, redirectUri: string): Flow | null {
  try {
    if (!cookie) return null;
    const [payload, signature] = cookie.split('.');
    const expected = sign(payload);
    if (!signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const flow = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Flow;
    return flow.state === state && flow.redirectUri === redirectUri && flow.expiresAt > Date.now() ? flow : null;
  } catch { return null; }
}

export const oauthCookie = (value = '', clear = false) => `${oauthCookieName}=${value}; HttpOnly; Path=/api/v1/auth/google; SameSite=Lax; Max-Age=${clear ? 0 : 600}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
export const readOAuthCookie = (header?: string) => header?.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${oauthCookieName}=`))?.slice(oauthCookieName.length + 1) ?? null;
