import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { createHash, timingSafeEqual } from 'node:crypto';
import { getSecret } from './secrets.js';

export type AuthTokenPayload = JwtPayload & {
  sub: string;
  email: string;
  role: 'unassigned' | 'super_admin' | 'manager' | 'accountant' | 'staff' | 'resident';
  tenantId?: string;
  impersonatorSub?: string;
};

export type PasswordResetTokenPayload = JwtPayload & {
  sub: string;
  email: string;
  purpose: 'password_reset';
};

type AccessTokenInput = {
  sub: string;
  email: string;
  role: AuthTokenPayload['role'];
  tenantId?: string;
  impersonatorSub?: string;
};

function jwtSecret() {
  const secret = getSecret('JWT_SECRET');
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters.');
  }
  return secret;
}

export const hashSensitiveToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const matchesSensitiveToken = (token: string, hash: string) => {
  const actual = Buffer.from(hashSensitiveToken(token));
  const expected = Buffer.from(hash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

const jwtIssuer = () => process.env.JWT_ISSUER ?? 'homelink-api';
const jwtAudience = () => process.env.JWT_AUDIENCE ?? 'homelink-web';

export function createAccessToken(payload: AccessTokenInput) {
  const configured = Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900);
  if (!Number.isInteger(configured) || configured < 60 || configured > 900) {
    throw new Error('ACCESS_TOKEN_TTL_SECONDS must be between 60 and 900 seconds.');
  }
  return jwt.sign(payload, jwtSecret(), { expiresIn: configured as SignOptions['expiresIn'], issuer: jwtIssuer(), audience: jwtAudience(), algorithm: 'HS256' });
}

export function verifyAccessToken(token: string): AuthTokenPayload | null {
  try {
    const payload = jwt.verify(token, jwtSecret(), { issuer: jwtIssuer(), audience: jwtAudience(), algorithms: ['HS256'], maxAge: '15m', clockTolerance: 5 });
    if (
      typeof payload === 'string'
      || typeof payload.sub !== 'string'
      || typeof payload.email !== 'string'
      || typeof payload.role !== 'string'
    ) return null;
    return payload as AuthTokenPayload;
  } catch {
    return null;
  }
}

export function createPasswordResetToken(payload: { sub: string; email: string }) {
  return jwt.sign({ ...payload, purpose: 'password_reset' }, jwtSecret(), { expiresIn: '10m', issuer: jwtIssuer(), audience: `${jwtAudience()}:password-reset`, algorithm: 'HS256' });
}

export function verifyPasswordResetToken(token: string): PasswordResetTokenPayload | null {
  try {
    const payload = jwt.verify(token, jwtSecret(), { issuer: jwtIssuer(), audience: `${jwtAudience()}:password-reset`, algorithms: ['HS256'], maxAge: '10m', clockTolerance: 5 });
    if (
      typeof payload === 'string'
      || typeof payload.sub !== 'string'
      || typeof payload.email !== 'string'
      || payload.purpose !== 'password_reset'
    ) return null;
    return payload as PasswordResetTokenPayload;
  } catch {
    return null;
  }
}
