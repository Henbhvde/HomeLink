import jwt, { type JwtPayload } from 'jsonwebtoken';
import { afterEach, describe, expect, it } from 'vitest';
import { createAccessToken, verifyAccessToken } from './auth.js';

const previousSecret = process.env.JWT_SECRET;
const previousTtl = process.env.ACCESS_TOKEN_TTL_SECONDS;
afterEach(() => {
  if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
  if (previousTtl === undefined) delete process.env.ACCESS_TOKEN_TTL_SECONDS; else process.env.ACCESS_TOKEN_TTL_SECONDS = previousTtl;
});

describe('access token lifetime', () => {
  it('defaults to at most 15 minutes', () => {
    process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters';
    delete process.env.ACCESS_TOKEN_TTL_SECONDS;
    const payload = jwt.decode(createAccessToken({ sub: '1', email: 'a@b.mn', role: 'manager' })) as JwtPayload;
    expect(payload.exp! - payload.iat!).toBe(900);
  });

  it('rejects a long-lived configuration', () => {
    process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters';
    process.env.ACCESS_TOKEN_TTL_SECONDS = '3600';
    expect(() => createAccessToken({ sub: '1', email: 'a@b.mn', role: 'manager' })).toThrow();
  });

  it('validates issuer, audience and expiry', () => {
    process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters';
    const valid = createAccessToken({ sub: '1', email: 'a@b.mn', role: 'manager' });
    expect(verifyAccessToken(valid)?.sub).toBe('1');
    const wrongAudience = jwt.sign({ sub: '1', email: 'a@b.mn', role: 'manager' }, process.env.JWT_SECRET, { expiresIn: '5m', issuer: 'homelink-api', audience: 'other' });
    const expired = jwt.sign({ sub: '1', email: 'a@b.mn', role: 'manager' }, process.env.JWT_SECRET, { expiresIn: -10, issuer: 'homelink-api', audience: 'homelink-web' });
    expect(verifyAccessToken(wrongAudience)).toBeNull();
    expect(verifyAccessToken(expired)).toBeNull();
  });
});
