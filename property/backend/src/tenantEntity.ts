export function belongsToTenant(entity: unknown, tenantId: string, id: string): entity is Record<string, unknown> & { tenantId: string } {
  return typeof entity === 'object'
    && entity !== null
    && String((entity as { id?: unknown }).id) === id
    && (entity as { tenantId?: unknown }).tenantId === tenantId;
}

export function findTenantEntity(items: unknown[], tenantId: string, id: string) {
  return items.find((item) => belongsToTenant(item, tenantId, id));
}

export function enforceTenantScope(value: unknown, tenantId: string): unknown {
  return Array.isArray(value)
    ? value.map((item) => typeof item === 'object' && item !== null ? { ...item, tenantId } : item)
    : typeof value === 'object' && value !== null ? { ...value, tenantId } : value;
}
