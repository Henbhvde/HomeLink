import { afterEach, describe, expect, it } from 'vitest';
import { corsAllowlist, validateProductionEnvironment } from './environment.js';

describe('production environment hardening', () => {
  const original = { ...process.env };
  afterEach(() => { process.env = { ...original }; });

  it('rejects placeholders and insecure origins', () => {
    process.env.NODE_ENV = 'production';
    process.env.POSTGRES_URL = 'postgresql://db/prod'; process.env.REDIS_URL = 'redis://cache';
    process.env.JWT_SECRET = 'replace-with-at-least-32-random-characters'; process.env.FRONTEND_URLS = 'http://app.test';
    expect(validateProductionEnvironment).toThrow();
  });

  it('supports an explicit comma-separated allowlist', () => {
    process.env.NODE_ENV = 'development'; process.env.FRONTEND_URLS = 'https://a.test, https://b.test';
    expect(corsAllowlist()).toEqual(['https://a.test', 'https://b.test']);
  });
});
