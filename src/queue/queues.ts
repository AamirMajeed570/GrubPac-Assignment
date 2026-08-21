import { Queue } from 'bullmq';
import { createRedisConnection } from './connection';

export const QUEUE_NAMES = {
  EMAIL: 'email-notifications',
  EMAIL_DLQ: 'email-notifications-dlq',
} as const;

// Lazily initialized queues
let emailQueue: Queue | null = null;
let emailDlq: Queue | null = null;

export function getEmailQueue(): Queue {
  if (!emailQueue) {
    emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000, // 1s → 2s → 4s
        },
        removeOnComplete: { count: 100 },
        removeOnFail: false, // keep failed jobs for DLQ move
      },
    });
  }
  return emailQueue;
}

export function getEmailDlq(): Queue {
  if (!emailDlq) {
    emailDlq = new Queue(QUEUE_NAMES.EMAIL_DLQ, {
      connection: createRedisConnection(),
    });
  }
  return emailDlq;
}

export async function closeQueues(): Promise<void> {
  if (emailQueue) {
    await emailQueue.close();
    emailQueue = null;
  }
  if (emailDlq) {
    await emailDlq.close();
    emailDlq = null;
  }
}
