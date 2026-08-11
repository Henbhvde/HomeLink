import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('A03 injection safety', () => {
  it('allows only Prisma tagged, parameterized raw queries', () => {
    const files = readdirSync(new URL('.', import.meta.url)).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'));
    for (const file of files) {
      const source = readFileSync(join(new URL('.', import.meta.url).pathname.slice(1), file), 'utf8');
      expect(source, file).not.toMatch(/\$(?:queryRawUnsafe|executeRawUnsafe)\b/);
      expect(source, file).not.toMatch(/\$(?:queryRaw|executeRaw)(?:<[^>]+>)?\s*\(/);
    }
  });
});
