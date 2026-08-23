import '../src/config/env';
import { emailWorker } from './email.worker';
import { logger } from '../src/utils/logger';

logger.info('TaskFlow Worker starting...');

const shutdown = async (signal: string) => {
  logger.info(`Worker received ${signal}, shutting down...`);
  await emailWorker.close();
  logger.info('Worker shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

logger.info('Email worker started and listening for jobs');
