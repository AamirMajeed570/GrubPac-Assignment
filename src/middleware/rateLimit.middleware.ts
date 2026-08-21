import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { ErrorCode } from '../utils/errors';

/**
 * Rate limiter for auth endpoints.
 * Assignment requires: 10 requests/minute/IP
 */
export const authRateLimit = rateLimit({
  windowMs: env.rateLimit.authWindowMs,   // default: 60 000 ms (1 min)
  max: env.rateLimit.authMax,             // default: 10 requests
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests, please try again later',
    code: ErrorCode.VALIDATION_ERROR,
    details: {},
  },
  keyGenerator: (req) => req.ip ?? 'unknown',
});
