/**
 * Integration tests — Validation & error scenarios.
 * Verifies consistent error response shapes for common invalid inputs.
 */

import request from 'supertest';
import { createApp } from '../../src/app';
import { testPrisma, cleanDatabase, disconnectTestDb } from '../helpers/db';
import { createOrg, createUser, createMembership, createProject } from '../helpers/factories';
import { makeAccessToken, bearerHeader } from '../helpers/auth';

const app = createApp();

jest.mock('../../src/queue/queues', () => ({
  getEmailQueue: jest.fn(() => ({ add: jest.fn().mockResolvedValue({ id: 'j1' }) })),
  getEmailDlq: jest.fn(() => ({ add: jest.fn(), getJob: jest.fn().mockResolvedValue(null) })),
  QUEUE_NAMES: { EMAIL: 'email-notifications', EMAIL_DLQ: 'email-notifications-dlq' },
}));

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe('Error response shape', () => {
  it('always returns { error, code, details }', async () => {
    const res = await request(app).get('/projects');
    // Unauthorized — no token
    expect(res.body).toMatchObject({
      error: expect.any(String),
      code: expect.any(String),
      details: expect.any(Object),
    });
  });

  it('404 on unknown route', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

describe('Project validation', () => {
  it('returns 422 when project name is missing', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma);
    await createMembership(testPrisma, user.id, org.id);
    const token = makeAccessToken(user.id, org.id, 'member', user.email);

    const res = await request(app)
      .post('/projects')
      .set(bearerHeader(token))
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when project does not exist', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma);
    await createMembership(testPrisma, user.id, org.id);
    const token = makeAccessToken(user.id, org.id, 'member', user.email);

    const res = await request(app)
      .get('/projects/00000000-0000-0000-0000-000000000000')
      .set(bearerHeader(token));

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PROJECT_NOT_FOUND');
  });
});

describe('Task validation', () => {
  it('returns 422 when task title is missing', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma);
    await createMembership(testPrisma, user.id, org.id);
    const project = await createProject(testPrisma, org.id);
    const token = makeAccessToken(user.id, org.id, 'member', user.email);

    const res = await request(app)
      .post(`/projects/${project.id}/tasks`)
      .set(bearerHeader(token))
      .send({ priority: 'high' }); // missing title

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when task status is invalid', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma);
    await createMembership(testPrisma, user.id, org.id);
    const project = await createProject(testPrisma, org.id);
    const token = makeAccessToken(user.id, org.id, 'member', user.email);

    const res = await request(app)
      .post(`/projects/${project.id}/tasks`)
      .set(bearerHeader(token))
      .send({ title: 'Bad Status Task', status: 'invalid' });

    expect(res.status).toBe(422);
  });
});

describe('Assignment validation', () => {
  it('returns 422 for non-UUID userId in assign', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma);
    await createMembership(testPrisma, user.id, org.id);
    const project = await createProject(testPrisma, org.id);
    const token = makeAccessToken(user.id, org.id, 'member', user.email);
    const task = await testPrisma.task.create({
      data: { projectId: project.id, creatorId: user.id, title: 'T', priority: 'medium', status: 'todo' },
    });

    const res = await request(app)
      .post(`/tasks/${task.id}/assign`)
      .set(bearerHeader(token))
      .send({ userId: 'not-a-uuid' });

    expect(res.status).toBe(422);
  });
});
