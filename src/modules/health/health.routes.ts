import { Router, Request, Response } from 'express';
import { prisma } from '../../config/database';
import { getRedisClient } from '../../queue/connection';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /health
 * Returns liveness + readiness info (DB and Redis connectivity).
 */
router.get('/', async (_req: Request, res: Response) => {
  const health: Record<string, string> = {
    status: 'ok',
    database: 'unknown',
    redis: 'unknown',
  };

  // Check PostgreSQL
  try {
    await prisma.$queryRaw`SELECT 1`;
    health['database'] = 'connected';
  } catch (err) {
    logger.warn('Health check: database unreachable', { err });
    health['database'] = 'disconnected';
    health['status'] = 'degraded';
  }

  // Check Redis
  try {
    const redis = getRedisClient();
    await redis.ping();
    health['redis'] = 'connected';
  } catch (err) {
    logger.warn('Health check: redis unreachable', { err });
    health['redis'] = 'disconnected';
    health['status'] = 'degraded';
  }

  const statusCode = health['status'] === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

export default router;
