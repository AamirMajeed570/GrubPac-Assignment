import { Router, Request, Response } from 'express';
import { prisma } from '../../config/database';
import { getRedisClient } from '../../queue/connection';
import { logger } from '../../utils/logger';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const health: Record<string, string> = { status: 'ok', database: 'unknown', redis: 'unknown' };

  try {
    await prisma.$queryRaw`SELECT 1`;
    health['database'] = 'connected';
  } catch (err) {
    logger.warn('Health check: database unreachable', { err });
    health['database'] = 'disconnected';
    health['status'] = 'degraded';
  }

  try {
    const redis = getRedisClient();
    await redis.ping();
    health['redis'] = 'connected';
  } catch (err) {
    logger.warn('Health check: redis unreachable', { err });
    health['redis'] = 'disconnected';
    health['status'] = 'degraded';
  }

  res.status(health['status'] === 'ok' ? 200 : 503).json(health);
});

export default router;
