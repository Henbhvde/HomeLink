import { createClient } from 'redis';

const globalForRedis = globalThis as unknown as {
  redis: ReturnType<typeof createClient> | undefined;
};

export const redis = globalForRedis.redis ?? createClient({
  url: process.env.REDIS_URL,
});

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

redis.on('error', (error) => {
  console.error('Redis connection error:', error instanceof Error ? error.message : 'Unknown error');
});

export async function ensureRedisConnection() {
  if (!redis.isOpen) await redis.connect();
  return redis;
}
