import { describe, expect, it } from 'vitest';
import { isBreachedPassword } from './passwordSecurity.js';
import { passwordPolicySchema } from './validation.js';

describe('password security', () => {
  it('enforces strength and detects known breached passwords', async () => {
    expect(passwordPolicySchema.safeParse('short').success).toBe(false);
    expect(passwordPolicySchema.safeParse('Correct-Horse-2026').success).toBe(true);
    await expect(isBreachedPassword('Password123!')).resolves.toBe(true);
  });
});
