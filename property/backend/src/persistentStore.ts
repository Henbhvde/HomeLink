import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

type StoredDocument = {
  version: 1;
  platformTenants?: unknown;
  scopes: Record<string, unknown>;
};

const emptyDocument = (): StoredDocument => ({ version: 1, scopes: {} });

/**
 * A small persistent repository used by the local product environment.
 *
 * Data is written atomically to the backend's data directory, never to the
 * browser. The API surface intentionally stays independent from the storage
 * mechanism so this repository can later be replaced with PostgreSQL without
 * changing the UI contracts.
 */
export class PersistentStore {
  private readonly filePath: string;
  private document: StoredDocument = emptyDocument();
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(filePath = process.env.DATA_FILE ?? join(process.cwd(), 'data', 'homelink-data.json')) {
    this.filePath = filePath;
  }

  async initialize() {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<StoredDocument>;
      this.document = {
        version: 1,
        platformTenants: parsed.platformTenants,
        scopes: parsed.scopes && typeof parsed.scopes === 'object' ? parsed.scopes : {},
      };
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String(error.code) : '';
      if (code !== 'ENOENT') throw error;
      await mkdir(dirname(this.filePath), { recursive: true });
      await this.write();
    }
  }

  async getPlatformTenants<T>(seed: T): Promise<T> {
    if (!Array.isArray(this.document.platformTenants)) {
      this.document.platformTenants = seed;
      await this.write();
    }
    return this.document.platformTenants as T;
  }

  async setPlatformTenants<T>(value: T) {
    this.document.platformTenants = value;
    await this.write();
  }

  async getScope<T>(scope: string): Promise<T | undefined> {
    return this.document.scopes[scope] as T | undefined;
  }

  async setScope<T>(scope: string, value: T) {
    this.document.scopes[scope] = value;
    await this.write();
  }

  private async write() {
    const snapshot = JSON.stringify(this.document, null, 2);
    const temporaryPath = `${this.filePath}.tmp`;
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true });
      await writeFile(temporaryPath, snapshot, 'utf8');
      await rename(temporaryPath, this.filePath);
    });
    return this.writeQueue;
  }
}
