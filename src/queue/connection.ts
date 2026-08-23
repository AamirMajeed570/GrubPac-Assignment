import IORedis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../utils/logger';

let redisClient: IORedis | null = null;

export function getRedisClient(): IORedis {
  if (!redisClient) {
    redisClient = new IORedis({
      host: env.redis.host,
      port: env.redis.port,
      password: env.redis.password,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    redisClient.on('connect', () => logger.info('Redis connected'));
    redisClient.on('error', (err) => logger.error('Redis error', { err: err.message }));
  }
  return redisClient;
}

export function createRedisConnection(): IORedis {
  return new IORedis({
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
