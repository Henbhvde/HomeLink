import { describe, expect, it } from 'vitest';
import { isRateLimited } from './rateLimit.js';

describe('rate limiting', () => {
  it('allows the configured maximum and blocks the next request', () => {
    expect(isRateLimited(10, 10)).toBe(false);
    expect(isRateLimited(11, 10)).toBe(true);
  });
});
