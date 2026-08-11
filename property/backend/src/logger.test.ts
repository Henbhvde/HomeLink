import { describe, expect, it } from 'vitest';
import { logFields } from './logger.js';

describe('structured logger context', () => {
  it('includes request, user and tenant IDs', () => {
    const fields = logFields({ method: 'GET', path: '/api/x' } as never, { locals: { requestId: 'r1', auth: { sub: 'u1', tenantId: 't1' } } } as never);
    expect(fields).toMatchObject({ requestId: 'r1', userId: 'u1', tenantId: 't1' });
  });
});
