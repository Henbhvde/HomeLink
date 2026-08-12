import { createClient } from 'redis';

type SetOptions = { EX?: number; NX?: boolean };
export type RedisStore = {
  ping(): Promise<string>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<boolean>;
  ttl(key: string): Promise<number>;
  set(key: string, value: string, options?: SetOptions): Promise<string | null>;
  get(key: string): Promise<string | null>;
  del(keys: string | string[]): Promise<number>;
  rPush(key: string, values: string | string[]): Promise<number>;
  lPop(key: string): Promise<string | null>;
};

type Entry = { value: string; expiresAt?: number };
class MemoryRedis implements RedisStore {
  private values = new Map<string, Entry>();
  private queues = new Map<string, string[]>();

  private entry(key: string) {
    const item = this.values.get(key);
    if (item?.expiresAt && item.expiresAt <= Date.now()) { this.values.delete(key); return undefined; }
    return item;
  }
  async ping() { return 'PONG'; }
  async incr(key: string) { const item = this.entry(key); const value = Number(item?.value ?? 0) + 1; this.values.set(key, { value: String(value), expiresAt: item?.expiresAt }); return value; }
  async expire(key: string, seconds: number) { const item = this.entry(key); if (!item) return false; item.expiresAt = Date.now() + seconds * 1000; return true; }
  async ttl(key: string) { const item = this.entry(key); if (!item) return -2; return item.expiresAt ? Math.max(0, Math.ceil((item.expiresAt - Date.now()) / 1000)) : -1; }
  async set(key: string, value: string, options?: SetOptions) {
    if (options?.NX && this.entry(key)) return null;
    this.values.set(key, { value, expiresAt: options?.EX ? Date.now() + options.EX * 1000 : undefined });
    return 'OK';
  }
  async get(key: string) { return this.entry(key)?.value ?? null; }
  async del(keys: string | string[]) { let deleted = 0; for (const key of Array.isArray(keys) ? keys : [keys]) { if (this.values.delete(key)) deleted++; if (this.queues.delete(key)) deleted++; } return deleted; }
  async rPush(key: string, values: string | string[]) { const queue = this.queues.get(key) ?? []; queue.push(...(Array.isArray(values) ? values : [values])); this.queues.set(key, queue); return queue.length; }
  async lPop(key: string) { return this.queues.get(key)?.shift() ?? null; }
}

const redisUrl = process.env.REDIS_URL?.trim();
const invalidRedisMarkers = ['replace-with', 'change-me', 'your-'];
if (process.env.NODE_ENV === 'production') invalidRedisMarkers.push('localhost', '127.0.0.1');
const hasRedisUrl = Boolean(redisUrl && !invalidRedisMarkers.some((item) => redisUrl.toLowerCase().includes(item)));
const memoryRedis = new MemoryRedis();
const redisClient = hasRedisUrl ? createClient({
  url: redisUrl,
  socket: { connectTimeout: 3_000, reconnectStrategy: false },
}) : null;
let connectionAttempt: Promise<RedisStore> | undefined;
let mode: 'redis' | 'memory' = 'memory';

redisClient?.on('error', (error) => console.warn('Redis unavailable; using in-memory fallback:', error instanceof Error ? error.message : 'Unknown error'));

export const getRedisMode = () => mode;
export async function ensureRedisConnection(): Promise<RedisStore> {
  if (!redisClient) return memoryRedis;
  if (redisClient.isReady) { mode = 'redis'; return redisClient as unknown as RedisStore; }
  if (!connectionAttempt) {
    connectionAttempt = redisClient.connect()
      .then(() => { mode = 'redis'; return redisClient as unknown as RedisStore; })
      .catch((error) => { console.warn('Redis connection failed; continuing with in-memory fallback:', error instanceof Error ? error.message : 'Unknown error'); return memoryRedis; });
  }
  return connectionAttempt;
}

// Backwards-compatible facade for tests and callers that previously used the
// node-redis client directly. It also works when Redis is intentionally absent.
export const redis = {
  get isOpen() { return Boolean(redisClient?.isOpen); },
  async set(key: string, value: string, options?: SetOptions) { return (await ensureRedisConnection()).set(key, value, options); },
  async get(key: string) { return (await ensureRedisConnection()).get(key); },
  async del(keys: string | string[]) { return (await ensureRedisConnection()).del(keys); },
  async disconnect() { if (redisClient?.isOpen) await redisClient.disconnect(); },
};
