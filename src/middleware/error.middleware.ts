import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { AppError, ErrorCode } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Centralized error handler.
 * Produces consistent { error, code, details } responses.
 * Never leaks stack traces or internal details in production.
 */
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Known application errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details,
    });
    return;
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(422).json({
      error: 'Validation failed',
      code: ErrorCode.VALIDATION_ERROR,
      details: err.flatten().fieldErrors,
    });
    return;
  }

  // JWT errors
  if (err instanceof TokenExpiredError) {
    res.status(401).json({
      error: 'Token expired',
      code: ErrorCode.TOKEN_EXPIRED,
      details: {},
    });
    return;
  }

  if (err instanceof JsonWebTokenError) {
    res.status(401).json({
      error: 'Invalid token',
      code: ErrorCode.UNAUTHORIZED,
      details: {},
    });
    return;
  }

  // Unexpected errors — log and return generic 500
  logger.error('Unhandled error', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  res.status(500).json({
    error: 'Internal server error',
    code: ErrorCode.INTERNAL_ERROR,
    details: {},
  });
}

/**
 * 404 handler for unmatched routes.
 */
export function notFoundMiddleware(_req: Request, res: Response): void {
  res.status(404).json({
    error: 'Route not found',
    code: ErrorCode.NOT_FOUND,
    details: {},
  });
}
