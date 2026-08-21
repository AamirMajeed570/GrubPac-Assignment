/**
 * Worker entry point.
 * Starts all BullMQ workers.
 * Runs as a separate process from the API.
 *
 * Full implementation: Phase 6
 */

import '../src/config/env'; // ensure env is loaded
import { emailWorker } from './email.worker';
import { logger } from '../src/utils/logger';

logger.info('TaskFlow Worker starting...');

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`Worker received ${signal}, shutting down...`);
  await emailWorker.close();
  logger.info('Worker shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

logger.info('Email worker started and listening for jobs');
