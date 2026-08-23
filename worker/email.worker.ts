import { Worker, Job } from 'bullmq';
import { createRedisConnection, getEmailDlq } from '../src/queue/connection-worker';
import { QUEUE_NAMES } from '../src/queue/queues';
import { EmailJobPayload } from '../src/queue/jobs/email.job';
import { logger } from '../src/utils/logger';
import { env } from '../src/config/env';

async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<void> {
  if (env.email.resendApiKey) {
    const { Resend } = await import('resend');
    const resend = new Resend(env.email.resendApiKey);
    const { error } = await resend.emails.send({ from: env.email.from, to: opts.to, subject: opts.subject, html: opts.html });
    if (error) throw new Error(`Resend error: ${error.message}`);
    logger.info('Email sent via Resend', { to: opts.to, subject: opts.subject });
  } else {
    logger.info('[MOCK EMAIL]', { to: opts.to, subject: opts.subject });
  }
}

async function processEmailJob(job: Job<EmailJobPayload>): Promise<void> {
  const { type, to, assigneeName, assignerName, taskTitle, projectName, organizationName } = job.data;

  if (type === 'TASK_ASSIGNED') {
    await sendEmail({
      to,
      subject: `You've been assigned to: ${taskTitle}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
          <h2 style="color:#1a1a1a">New task assignment</h2>
          <p>Hi <strong>${assigneeName}</strong>,</p>
          <p>
            <strong>${assignerName}</strong> has assigned you to
            <strong>"${taskTitle}"</strong> in the
            <strong>${projectName}</strong> project (${organizationName}).
          </p>
          <p>Log in to TaskFlow to view and manage the task.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
          <p style="color:#888;font-size:12px">This notification was sent by TaskFlow.</p>
        </div>
      `,
    });
    return;
  }

  throw new Error(`Unknown email job type: ${type}`);
}

export const emailWorker = new Worker<EmailJobPayload>(
  QUEUE_NAMES.EMAIL,
  processEmailJob,
  { connection: createRedisConnection(), concurrency: 5 }
);

emailWorker.on('completed', (job) => {
  logger.info('Email job completed', { jobId: job.id });
});

emailWorker.on('failed', async (job, err) => {
  if (!job) return;

  const attemptsUsed = job.attemptsMade;
  const maxAttempts = job.opts.attempts ?? 3;

  logger.warn('Email job failed', { jobId: job.id, attempt: attemptsUsed, maxAttempts, error: err.message });

  if (attemptsUsed >= maxAttempts) {
    try {
      const dlq = getEmailDlq();
      await dlq.add('dead-letter', {
        ...job.data,
        _failedJobId: job.id,
        _failedAt: new Date().toISOString(),
        _error: err.message,
      });
      logger.warn('Email job moved to DLQ', { originalJobId: job.id });
    } catch (dlqErr) {
      logger.error('Failed to move job to DLQ', { jobId: job.id, dlqErr });
    }
  }
});

emailWorker.on('error', (err) => {
  logger.error('Email worker error', { err: err.message });
});
