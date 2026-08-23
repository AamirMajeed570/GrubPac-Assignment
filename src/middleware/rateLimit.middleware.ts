import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { ErrorCode } from '../utils/errors';

export const authRateLimit = rateLimit({
  windowMs: env.rateLimit.authWindowMs,
  max: env.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests, please try again later',
    code: ErrorCode.VALIDATION_ERROR,
    details: {},
  },
  keyGenerator: (req) => req.ip ?? 'unknown',
});
