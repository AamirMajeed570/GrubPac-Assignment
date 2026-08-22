/**
 * Email notification worker.
 *
 * Sending strategy:
 *   - RESEND_API_KEY is set → sends real emails via Resend (free tier, no domain needed)
 *   - RESEND_API_KEY is not set → mock mode: logs the email to console only
 *
 * Retry: 3 attempts, exponential backoff 1s → 2s → 4s (configured on the queue).
 * DLQ: after all retries exhausted, job is copied to email-notifications-dlq.
 */

import { Worker, Job } from 'bullmq';
import { createRedisConnection, getEmailDlq } from '../src/queue/connection-worker';
import { QUEUE_NAMES } from '../src/queue/queues';
import { EmailJobPayload } from '../src/queue/jobs/email.job';
import { logger } from '../src/utils/logger';
import { env } from '../src/config/env';

// ── Email sender ──────────────────────────────────────────────────────────────

async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (env.email.resendApiKey) {
    // Real sending via Resend — no domain needed, uses onboarding@resend.dev
    const { Resend } = await import('resend');
    const resend = new Resend(env.email.resendApiKey);

    const { error } = await resend.emails.send({
      from: env.email.from,   // 'onboarding@resend.dev' by default
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }

    logger.info('📧 Email sent via Resend', { to: opts.to, subject: opts.subject });
  } else {
    // Mock mode — log only, no external call
    logger.info('📧 [MOCK EMAIL] Skipping real send (RESEND_API_KEY not set)', {
      to: opts.to,
      subject: opts.subject,
      preview: opts.html.replace(/<[^>]+>/g, '').slice(0, 120),
    });
  }
}

// ── Job processor ─────────────────────────────────────────────────────────────

async function processEmailJob(job: Job<EmailJobPayload>): Promise<void> {
  const { type, to, assigneeName, assignerName, taskTitle, projectName, organizationName } =
    job.data;

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
            <strong>${projectName}</strong> project
            (${organizationName}).
          </p>
          <p>Log in to TaskFlow to view and manage the task.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
          <p style="color:#888;font-size:12px">
            This notification was sent by TaskFlow.
          </p>
        </div>
      `,
    });
    return;
  }

  throw new Error(`Unknown email job type: ${type}`);
}

// ── Worker instance ───────────────────────────────────────────────────────────

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
  logger.info('Email job completed', { jobId: job.id });
});

emailWorker.on('failed', async (job, err) => {
  if (!job) return;

  const attemptsUsed = job.attemptsMade;
  const maxAttempts = job.opts.attempts ?? 3;

  logger.warn('Email job failed', {
    jobId: job.id,
    attempt: attemptsUsed,
    maxAttempts,
    error: err.message,
  });

  // After all retries exhausted → move to dead-letter queue
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
