import { createApp } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { closeRedisClient } from './queue/connection';
import { closeQueues } from './queue/queues';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  logger.info(`Starting TaskFlow API... [NODE_ENV=${env.nodeEnv}, PORT=${env.port}]`);

  // Debug: list /app contents to verify Docker copy
  try {
    const fs = await import('fs');
    logger.info('Contents of /app: ' + fs.readdirSync('/app').join(', '));
    if (fs.existsSync('/app/docs')) {
      logger.info('Contents of /app/docs: ' + fs.readdirSync('/app/docs').join(', '));
    } else {
      logger.warn('/app/docs directory does NOT exist');
    }
  } catch (e) {
    logger.warn('Could not list /app directory');
  }

  // Connect to PostgreSQL
  logger.info('Connecting to database...');
  await connectDatabase();
  logger.info('Database connected');

  logger.info('Creating Express app...');
  const app = createApp();

  logger.info(`Starting HTTP server on port ${env.port}...`);
  const server = app.listen(env.port, () => {
    logger.info(`TaskFlow API running on port ${env.port} [${env.nodeEnv}]`);
  });

  // ── Graceful shutdown ─────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    server.close(async () => {
      try {
        await closeQueues();
        await closeRedisClient();
        await disconnectDatabase();
        logger.info('Shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error('Error during shutdown', { err });
        process.exit(1);
      }
    });

    // Force-exit if graceful shutdown takes too long
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { err });
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
    process.exit(1);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  console.error('Stack:', err?.stack);
  console.error('Code:', err?.code);
  console.error('Message:', err?.message);
  process.exit(1);
});
