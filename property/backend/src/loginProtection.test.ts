import { describe, expect, it } from 'vitest';
import { loginPenaltySeconds } from './loginProtection.js';

describe('progressive login protection', () => {
  it('delays failures and locks after the threshold', () => {
    expect(loginPenaltySeconds(2)).toBe(0);
    expect(loginPenaltySeconds(3)).toBe(2);
    expect(loginPenaltySeconds(6)).toBe(16);
    expect(loginPenaltySeconds(8)).toBe(900);
  });
});
