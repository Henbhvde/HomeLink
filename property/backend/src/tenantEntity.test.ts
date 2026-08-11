import { describe, expect, it } from 'vitest';
import { enforceTenantScope, findTenantEntity } from './tenantEntity.js';

describe('tenant entity IDOR guard', () => {
  const items = [{ id: 'same-id', tenantId: 'tenant-a' }, { id: 'other', tenantId: 'tenant-b' }];

  it('returns only an entity owned by the authenticated tenant', () => {
    expect(findTenantEntity(items, 'tenant-a', 'same-id')).toEqual(items[0]);
    expect(findTenantEntity(items, 'tenant-b', 'same-id')).toBeUndefined();
  });

  it('overrides forged tenant IDs on writes', () => {
    expect(enforceTenantScope({ id: '1', tenantId: 'tenant-b' }, 'tenant-a')).toMatchObject({ tenantId: 'tenant-a' });
  });
});
