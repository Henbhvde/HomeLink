import { describe, expect, it } from 'vitest';
import { canResendInvite, inviteExpiry } from './inviteService.js';

describe('invite lifecycle', () => {
  it('sets seven-day expiry and enforces resend states', () => {
    expect(inviteExpiry(0).getTime()).toBe(7 * 24 * 60 * 60_000);
    expect(canResendInvite('expired')).toBe(true);
    expect(canResendInvite('revoked')).toBe(false);
    expect(canResendInvite('accepted')).toBe(false);
  });
});
