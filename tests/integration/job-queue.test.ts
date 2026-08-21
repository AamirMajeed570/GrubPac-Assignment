/**
 * Integration tests — ★ Bonus: Task assignment creates a queue job.
 *
 * Verifies that assigning a task calls getEmailQueue().add() with the
 * correct payload.
 */

import request from 'supertest';
import { createApp } from '../../src/app';
import { testPrisma, cleanDatabase, disconnectTestDb } from '../helpers/db';
import {
  createOrg,
  createUser,
  createMembership,
  createProject,
  createTask,
} from '../helpers/factories';
import { makeAccessToken, bearerHeader } from '../helpers/auth';

const app = createApp();

// ── Queue mock ──────────────────────────────────────────────────────────────
const mockQueueAdd = jest.fn().mockResolvedValue({ id: 'test-job-id-123' });

jest.mock('../../src/queue/queues', () => ({
  getEmailQueue: jest.fn(() => ({ add: mockQueueAdd })),
  getEmailDlq: jest.fn(() => ({ add: jest.fn(), getJob: jest.fn().mockResolvedValue(null) })),
  QUEUE_NAMES: { EMAIL: 'email-notifications', EMAIL_DLQ: 'email-notifications-dlq' },
}));

beforeEach(async () => {
  await cleanDatabase();
  jest.clearAllMocks();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe('Task assignment creates a queue job', () => {
  it('calls emailQueue.add() once with TASK_ASSIGNED payload', async () => {
    const org = await createOrg(testPrisma);
    const assigner = await createUser(testPrisma, { email: 'assigner@q.com' });
    const assignee = await createUser(testPrisma, { email: 'assignee@q.com', name: 'Test Assignee' });
    await createMembership(testPrisma, assigner.id, org.id);
    await createMembership(testPrisma, assignee.id, org.id);
    const project = await createProject(testPrisma, org.id, { name: 'Queue Test Project' });
    const task = await createTask(testPrisma, project.id, assigner.id, { title: 'Queue Test Task' });
    const token = makeAccessToken(assigner.id, org.id, 'member', assigner.email);

    const res = await request(app)
      .post(`/tasks/${task.id}/assign`)
      .set(bearerHeader(token))
      .send({ userId: assignee.id });

    expect(res.status).toBe(201);
    expect(res.body.jobId).toBe('test-job-id-123');

    // Verify queue.add was called
    expect(mockQueueAdd).toHaveBeenCalledTimes(1);

    const [jobName, payload] = mockQueueAdd.mock.calls[0] as [string, Record<string, unknown>];
    expect(jobName).toBe('send-email');
    expect(payload.type).toBe('TASK_ASSIGNED');
    expect(payload.to).toBe('assignee@q.com');
    expect(payload.assigneeName).toBe('Test Assignee');
    expect(payload.taskTitle).toBe('Queue Test Task');
    expect(payload.projectName).toBe('Queue Test Project');
  });

  it('assignment succeeds even if queue.add() throws (best-effort)', async () => {
    const org = await createOrg(testPrisma);
    const assigner = await createUser(testPrisma, { email: 'a1@q.com' });
    const assignee = await createUser(testPrisma, { email: 'a2@q.com' });
    await createMembership(testPrisma, assigner.id, org.id);
    await createMembership(testPrisma, assignee.id, org.id);
    const project = await createProject(testPrisma, org.id);
    const task = await createTask(testPrisma, project.id, assigner.id);
    const token = makeAccessToken(assigner.id, org.id, 'member', assigner.email);

    // Simulate queue failure
    mockQueueAdd.mockRejectedValueOnce(new Error('Redis unavailable'));

    const res = await request(app)
      .post(`/tasks/${task.id}/assign`)
      .set(bearerHeader(token))
      .send({ userId: assignee.id });

    // Assignment must succeed despite queue failure
    expect(res.status).toBe(201);
    expect(res.body.assignment.userId).toBe(assignee.id);

    // DB record must exist
    const dbAssignment = await testPrisma.taskAssignment.findUnique({
      where: { taskId_userId: { taskId: task.id, userId: assignee.id } },
    });
    expect(dbAssignment).not.toBeNull();
  });
});
