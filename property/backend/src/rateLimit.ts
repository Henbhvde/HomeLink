import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import { ensureRedisConnection } from './redis.js';
import { redisKey } from './redisPolicy.js';

type Options = { name: string; max: number; windowSeconds: number };
export const isRateLimited = (count: number, max: number) => count > max;

export const rateLimit = ({ name, max, windowSeconds }: Options): RequestHandler => async (req, res, next) => {
  const identity = `${req.ip}:${String(req.body?.email ?? '').trim().toLowerCase()}`;
  const key = redisKey.rateLimit(name, createHash('sha256').update(identity).digest('hex'));
  try {
    const redis = await ensureRedisConnection();
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSeconds);
    const ttl = Math.max(1, await redis.ttl(key));
    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', Math.max(0, max - count));
    if (isRateLimited(count, max)) {
      res.setHeader('Retry-After', ttl);
      return res.status(429).json({ success: false, message: 'Too many requests. Please try again later.', data: null });
    }
    next();
  } catch {
    if (process.env.NODE_ENV === 'production') return res.status(503).json({ success: false, message: 'Rate limiter is unavailable.', data: null });
    next();
  }
};

export const authRateLimits = {
  login: rateLimit({ name: 'login', max: 10, windowSeconds: 15 * 60 }),
  register: rateLimit({ name: 'register', max: 5, windowSeconds: 60 * 60 }),
  forgotPassword: rateLimit({ name: 'forgot-password', max: 5, windowSeconds: 60 * 60 }),
  verifyOtp: rateLimit({ name: 'verify-otp', max: 10, windowSeconds: 15 * 60 }),
  paymentWebhook: rateLimit({ name: 'payment-webhook', max: 60, windowSeconds: 60 }),
};
