import { getEmailQueue, getEmailDlq, QUEUE_NAMES } from '../../queue/queues';
import { notFound } from '../../utils/errors';

type JobStatus = 'pending' | 'active' | 'completed' | 'failed';

export interface JobInfo {
  jobId: string;
  status: JobStatus;
  queueName: string;
  metadata: {
    name: string;
    attemptsMade: number;
    failedReason?: string;
    processedOn?: number | null;
    finishedOn?: number | null;
    timestamp: number;
    data: unknown;
  };
}

export class JobService {
  /**
   * Get the current status of a job by ID.
   * Checks the main email queue first, then the DLQ.
   */
  async getJobById(jobId: string): Promise<JobInfo> {
    const emailQueue = getEmailQueue();
    const dlq = getEmailDlq();

    // Try main queue first
    let job = await emailQueue.getJob(jobId);
    let queueName: string = QUEUE_NAMES.EMAIL;

    // If not in main queue, check DLQ
    if (!job) {
      job = await dlq.getJob(jobId);
      queueName = QUEUE_NAMES.EMAIL_DLQ;
    }

    if (!job) {
      throw notFound('Job', jobId);
    }

    const state = await job.getState();

    // Map BullMQ states to our API's supported statuses
    const statusMap: Record<string, JobStatus> = {
      waiting: 'pending',
      delayed: 'pending',
      active: 'active',
      completed: 'completed',
      failed: 'failed',
      unknown: 'failed',
    };

    const status = statusMap[state] ?? 'pending';

    return {
      jobId: job.id ?? jobId,
      status,
      queueName,
      metadata: {
        name: job.name,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        timestamp: job.timestamp,
        data: job.data,
      },
    };
  }
}

export const jobService = new JobService();
