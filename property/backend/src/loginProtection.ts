import { createHash } from 'node:crypto';
import { ensureRedisConnection } from './redis.js';
import { redisKey, redisTtl } from './redisPolicy.js';

const identityHash = (email: string) => createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
export const loginPenaltySeconds = (failures: number) => failures >= 8 ? 15 * 60 : failures >= 3 ? 2 ** (failures - 2) : 0;

export async function currentLoginPenalty(email: string) {
  try { const redis = await ensureRedisConnection(); return Math.max(0, await redis.ttl(redisKey.loginLock(identityHash(email)))); }
  catch (error) { if (process.env.NODE_ENV === 'production') throw error; return 0; }
}

export async function recordLoginFailure(email: string) {
  try {
    const redis = await ensureRedisConnection(); const hash = identityHash(email); const key = redisKey.loginFailures(hash); const failures = await redis.incr(key);
    if (failures === 1) await redis.expire(key, redisTtl.loginFailures);
    const penalty = loginPenaltySeconds(failures);
    if (penalty) await redis.set(redisKey.loginLock(hash), '1', { EX: penalty });
    return penalty;
  } catch (error) { if (process.env.NODE_ENV === 'production') throw error; return 0; }
}

export async function clearLoginFailures(email: string) {
  try { const redis = await ensureRedisConnection(); const hash = identityHash(email); await redis.del([redisKey.loginFailures(hash), redisKey.loginLock(hash)]); }
  catch (error) { if (process.env.NODE_ENV === 'production') throw error; }
}
