import type { PrismaClient } from '@prisma/client';
import { PrismaStore } from './prismaStore.js';

export interface DataStore {
  initialize(): Promise<void>;
  getPlatformTenants<T>(seed: T): Promise<T>;
  setPlatformTenants<T>(value: T): Promise<void>;
  getScope<T>(scope: string): Promise<T | undefined>;
  setScope<T>(scope: string, value: T): Promise<void>;
}

export async function createDataStore(prisma: PrismaClient): Promise<DataStore> {
  if (process.env.NODE_ENV === 'production') return new PrismaStore(prisma);
  const { PersistentStore } = await import('./persistentStore.js');
  return new PersistentStore();
}
