import type { RequestHandler } from 'express';

export const requireTls: RequestHandler = (req, res, next) => {
  if (process.env.NODE_ENV !== 'production' || req.secure || req.header('x-forwarded-proto') === 'https') return next();
  return res.status(426).json({ success: false, message: 'HTTPS is required.', data: null });
};
