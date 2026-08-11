import { describe, expect, it } from 'vitest';
import { sanitizeAuditMetadata } from './auditLog.js';

describe('audit logging', () => {
  it('removes secrets from metadata', () => {
    expect(sanitizeAuditMetadata({ role: 'staff', password: 'x', refreshToken: 'y' })).toEqual({ role: 'staff' });
  });
});
