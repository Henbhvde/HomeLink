import { describe, expect, it } from 'vitest';
import { createStorageKey } from './fileStorage.js';

describe('file storage', () => {
  it('creates tenant-scoped non-traversable keys', () => {
    const key = createStorageKey('tenant-1', '../../proof.PNG');
    expect(key).toMatch(/^tenant-1\/[0-9a-f-]+\.png$/);
    expect(key).not.toContain('..');
  });
});
