export interface EmailJobPayload {
  type: 'TASK_ASSIGNED';
  to: string;
  assigneeName: string;
  assignerName: string;
  taskTitle: string;
  taskId: string;
  projectName: string;
  organizationName: string;
}

export const EMAIL_JOB_NAME = 'send-email';
