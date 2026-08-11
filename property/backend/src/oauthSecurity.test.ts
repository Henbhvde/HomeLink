import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createOAuthFlow, verifyOAuthFlow } from './oauthSecurity.js';

describe('OAuth flow security', () => {
  const previousSecret = process.env.JWT_SECRET;

  beforeEach(() => { process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters'; });
  afterEach(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  it('validates signed state, redirect URI and PKCE flow', () => {
    const flow = createOAuthFlow('http://localhost/auth/callback');
    expect(flow.challenge).not.toBe(flow.verifier);
    expect(verifyOAuthFlow(flow.cookie, flow.state, flow.redirectUri)?.nonce).toBe(flow.nonce);
    expect(verifyOAuthFlow(flow.cookie, 'wrong-state', flow.redirectUri)).toBeNull();
    expect(verifyOAuthFlow(flow.cookie, flow.state, 'http://evil.test/callback')).toBeNull();
  });

  it('rejects a tampered flow cookie', () => {
    const flow = createOAuthFlow('http://localhost/auth/callback');
    expect(verifyOAuthFlow(`${flow.cookie}x`, flow.state, flow.redirectUri)).toBeNull();
  });
});
