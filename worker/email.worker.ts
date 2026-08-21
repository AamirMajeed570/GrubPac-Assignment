/**
 * Email notification worker.
 *
 * Processes jobs from the email-notifications queue.
 * Mock email sending: logs the email content instead of calling an SMTP server.
 *
 * Retry configuration (set on the queue side at enqueue time):
 *   - 3 attempts with exponential backoff: 1s → 2s → 4s
 *   - After exhaustion: job is moved to DLQ by the failed event handler
 */

import { Worker, Job } from 'bullmq';
import { createRedisConnection, getEmailDlq } from '../src/queue/connection-worker';
import { QUEUE_NAMES } from '../src/queue/queues';
import { EmailJobPayload } from '../src/queue/jobs/email.job';
import { logger } from '../src/utils/logger';

async function processEmailJob(job: Job<EmailJobPayload>): Promise<void> {
  const { type, to, assigneeName, assignerName, taskTitle, projectName, organizationName } =
    job.data;

  if (type === 'TASK_ASSIGNED') {
    // ── Mock email sending ───────────────────────────────────────────────
    // In production, replace this with Nodemailer / SES / SendGrid etc.
    logger.info('📧 [MOCK EMAIL] Task assignment notification', {
      jobId: job.id,
      to,
      subject: `You've been assigned: ${taskTitle}`,
      body: [
        `Hi ${assigneeName},`,
        ``,
        `${assignerName} has assigned you to "${taskTitle}"`,
        `Project: ${projectName} (${organizationName})`,
        ``,
        `Log in to TaskFlow to view the task.`,
      ].join('\n'),
    });
    return;
  }

  throw new Error(`Unknown email job type: ${type}`);
}

export const emailWorker = new Worker<EmailJobPayload>(
  QUEUE_NAMES.EMAIL,
  processEmailJob,
  {
    connection: createRedisConnection(),
    concurrency: 5,
  }
);

// ── Event handlers ────────────────────────────────────────────────────────────

emailWorker.on('completed', (job) => {
  logger.info(`Email job completed`, { jobId: job.id });
});

emailWorker.on('failed', async (job, err) => {
  if (!job) return;

  const attemptsUsed = job.attemptsMade;
  const maxAttempts = job.opts.attempts ?? 3;

  logger.warn(`Email job failed`, {
    jobId: job.id,
    attempt: attemptsUsed,
    maxAttempts,
    error: err.message,
  });

  // After all retries exhausted → move to DLQ
  if (attemptsUsed >= maxAttempts) {
    try {
      const dlq = getEmailDlq();
      await dlq.add('dead-letter', {
        ...job.data,
        _failedJobId: job.id,
        _failedAt: new Date().toISOString(),
        _error: err.message,
      });
      logger.warn(`Email job moved to DLQ`, { originalJobId: job.id });
    } catch (dlqErr) {
      logger.error(`Failed to move job to DLQ`, {
        jobId: job.id,
        dlqErr,
      });
    }
  }
});

emailWorker.on('error', (err) => {
  logger.error('Email worker error', { err: err.message });
});
