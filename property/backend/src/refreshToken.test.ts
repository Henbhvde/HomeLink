import { describe, expect, it } from 'vitest';
import { readRefreshCookie, refreshCookie } from './refreshToken.js';

describe('refresh cookie', () => {
  it('is HttpOnly and scoped to auth endpoints', () => {
    const cookie = refreshCookie('secret');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/api/v1/auth');
    expect(readRefreshCookie(`other=x; ${cookie}`)).toBe('secret');
  });
});
