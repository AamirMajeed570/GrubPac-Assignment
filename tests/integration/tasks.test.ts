/**
 * Integration tests — Task CRUD + filters + assignment.
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

// Mock the email queue so tests don't need Redis
jest.mock('../../src/queue/queues', () => ({
  getEmailQueue: jest.fn(() => ({
    add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
  })),
  getEmailDlq: jest.fn(() => ({
    add: jest.fn().mockResolvedValue({}),
    getJob: jest.fn().mockResolvedValue(null),
  })),
  QUEUE_NAMES: {
    EMAIL: 'email-notifications',
    EMAIL_DLQ: 'email-notifications-dlq',
  },
}));

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe('Task CRUD', () => {
  it('POST /projects/:projectId/tasks — creates a task', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma);
    await createMembership(testPrisma, user.id, org.id);
    const project = await createProject(testPrisma, org.id);
    const token = makeAccessToken(user.id, org.id, 'member', user.email);

    const res = await request(app)
      .post(`/projects/${project.id}/tasks`)
      .set(bearerHeader(token))
      .send({ title: 'My Task', priority: 'high', status: 'todo' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('My Task');
    expect(res.body.priority).toBe('high');
    expect(res.body.projectId).toBe(project.id);
  });

  it('GET /projects/:projectId/tasks — lists tasks with pagination', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma);
    await createMembership(testPrisma, user.id, org.id);
    const project = await createProject(testPrisma, org.id);
    const token = makeAccessToken(user.id, org.id, 'member', user.email);

    await createTask(testPrisma, project.id, user.id, { title: 'Task A' });
    await createTask(testPrisma, project.id, user.id, { title: 'Task B' });
    await createTask(testPrisma, project.id, user.id, { title: 'Task C' });

    const res = await request(app)
      .get(`/projects/${project.id}/tasks`)
      .set(bearerHeader(token))
      .query({ page: 1, limit: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(3);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(2);
  });

  it('GET /projects/:projectId/tasks — filters by status', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma);
    await createMembership(testPrisma, user.id, org.id);
    const project = await createProject(testPrisma, org.id);
    const token = makeAccessToken(user.id, org.id, 'member', user.email);

    await createTask(testPrisma, project.id, user.id, { status: 'todo' });
    await createTask(testPrisma, project.id, user.id, { status: 'done' });
    await createTask(testPrisma, project.id, user.id, { status: 'done' });

    const res = await request(app)
      .get(`/projects/${project.id}/tasks`)
      .set(bearerHeader(token))
      .query({ status: 'done' });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data.every((t: { status: string }) => t.status === 'done')).toBe(true);
  });

  it('GET /tasks/:id — returns a specific task', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma);
    await createMembership(testPrisma, user.id, org.id);
    const project = await createProject(testPrisma, org.id);
    const task = await createTask(testPrisma, project.id, user.id, { title: 'Special Task' });
    const token = makeAccessToken(user.id, org.id, 'member', user.email);

    const res = await request(app)
      .get(`/tasks/${task.id}`)
      .set(bearerHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(task.id);
    expect(res.body.title).toBe('Special Task');
  });

  it('PATCH /tasks/:id — updates task fields', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma);
    await createMembership(testPrisma, user.id, org.id);
    const project = await createProject(testPrisma, org.id);
    const task = await createTask(testPrisma, project.id, user.id, { status: 'todo' });
    const token = makeAccessToken(user.id, org.id, 'member', user.email);

    const res = await request(app)
      .patch(`/tasks/${task.id}`)
      .set(bearerHeader(token))
      .send({ status: 'in_progress', priority: 'urgent' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_progress');
    expect(res.body.priority).toBe('urgent');
  });

  it('DELETE /tasks/:id — soft deletes the task', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma);
    await createMembership(testPrisma, user.id, org.id);
    const project = await createProject(testPrisma, org.id);
    const task = await createTask(testPrisma, project.id, user.id);
    const token = makeAccessToken(user.id, org.id, 'member', user.email);

    const deleteRes = await request(app)
      .delete(`/tasks/${task.id}`)
      .set(bearerHeader(token));
    expect(deleteRes.status).toBe(204);

    // Should return 404 after soft delete
    const getRes = await request(app)
      .get(`/tasks/${task.id}`)
      .set(bearerHeader(token));
    expect(getRes.status).toBe(404);
  });
});

describe('Task assignment', () => {
  it('POST /tasks/:id/assign — assigns a user and returns jobId', async () => {
    const org = await createOrg(testPrisma);
    const assignerUser = await createUser(testPrisma, { email: 'assigner@test.com' });
    const targetUser = await createUser(testPrisma, { email: 'target@test.com' });
    await createMembership(testPrisma, assignerUser.id, org.id);
    await createMembership(testPrisma, targetUser.id, org.id);
    const project = await createProject(testPrisma, org.id);
    const task = await createTask(testPrisma, project.id, assignerUser.id);
    const token = makeAccessToken(assignerUser.id, org.id, 'member', assignerUser.email);

    const res = await request(app)
      .post(`/tasks/${task.id}/assign`)
      .set(bearerHeader(token))
      .send({ userId: targetUser.id });

    expect(res.status).toBe(201);
    expect(res.body.assignment.userId).toBe(targetUser.id);
    expect(res.body.jobId).toBeDefined();
  });

  it('returns 409 on duplicate assignment', async () => {
    const org = await createOrg(testPrisma);
    const user1 = await createUser(testPrisma, { email: 'u1@test.com' });
    const user2 = await createUser(testPrisma, { email: 'u2@test.com' });
    await createMembership(testPrisma, user1.id, org.id);
    await createMembership(testPrisma, user2.id, org.id);
    const project = await createProject(testPrisma, org.id);
    const task = await createTask(testPrisma, project.id, user1.id);
    const token = makeAccessToken(user1.id, org.id, 'member', user1.email);

    await request(app)
      .post(`/tasks/${task.id}/assign`)
      .set(bearerHeader(token))
      .send({ userId: user2.id });

    const res = await request(app)
      .post(`/tasks/${task.id}/assign`)
      .set(bearerHeader(token))
      .send({ userId: user2.id });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_ASSIGNMENT');
  });

  it('DELETE /tasks/:id/assign/:userId — unassigns a user', async () => {
    const org = await createOrg(testPrisma);
    const user1 = await createUser(testPrisma, { email: 'ua@test.com' });
    const user2 = await createUser(testPrisma, { email: 'ub@test.com' });
    await createMembership(testPrisma, user1.id, org.id);
    await createMembership(testPrisma, user2.id, org.id);
    const project = await createProject(testPrisma, org.id);
    const task = await createTask(testPrisma, project.id, user1.id);
    const token = makeAccessToken(user1.id, org.id, 'member', user1.email);

    await testPrisma.taskAssignment.create({ data: { taskId: task.id, userId: user2.id } });

    const res = await request(app)
      .delete(`/tasks/${task.id}/assign/${user2.id}`)
      .set(bearerHeader(token));

    expect(res.status).toBe(204);
  });
});
