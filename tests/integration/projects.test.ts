/**
 * Integration tests — Projects CRUD.
 */

import request from 'supertest';
import { createApp } from '../../src/app';
import { testPrisma, cleanDatabase, disconnectTestDb } from '../helpers/db';
import {
  createOrg,
  createUser,
  createMembership,
  createProject,
} from '../helpers/factories';
import { makeAccessToken, bearerHeader } from '../helpers/auth';
import { OrgRole } from '@prisma/client';

const app = createApp();

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe('Projects CRUD', () => {
  it('POST /projects — creates a project in the user org', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma);
    await createMembership(testPrisma, user.id, org.id, OrgRole.org_admin);
    const token = makeAccessToken(user.id, org.id, 'org_admin', user.email);

    const res = await request(app)
      .post('/projects')
      .set(bearerHeader(token))
      .send({ name: 'My Project', description: 'A description' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('My Project');
    expect(res.body.organizationId).toBe(org.id);
  });

  it('GET /projects — lists only the org projects (paginated)', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma);
    await createMembership(testPrisma, user.id, org.id);
    await createProject(testPrisma, org.id, { name: 'Alpha' });
    await createProject(testPrisma, org.id, { name: 'Beta' });
    const token = makeAccessToken(user.id, org.id, 'member', user.email);

    const res = await request(app)
      .get('/projects')
      .set(bearerHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.page).toBe(1);
  });

  it('GET /projects/:id — returns a specific project', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma);
    await createMembership(testPrisma, user.id, org.id);
    const project = await createProject(testPrisma, org.id);
    const token = makeAccessToken(user.id, org.id, 'member', user.email);

    const res = await request(app)
      .get(`/projects/${project.id}`)
      .set(bearerHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(project.id);
  });

  it('PATCH /projects/:id — updates a project', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma);
    await createMembership(testPrisma, user.id, org.id);
    const project = await createProject(testPrisma, org.id, { name: 'Old Name' });
    const token = makeAccessToken(user.id, org.id, 'member', user.email);

    const res = await request(app)
      .patch(`/projects/${project.id}`)
      .set(bearerHeader(token))
      .send({ name: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
  });

  it('DELETE /projects/:id — soft deletes (org_admin only)', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma);
    await createMembership(testPrisma, user.id, org.id, OrgRole.org_admin);
    const project = await createProject(testPrisma, org.id);
    const token = makeAccessToken(user.id, org.id, 'org_admin', user.email);

    const res = await request(app)
      .delete(`/projects/${project.id}`)
      .set(bearerHeader(token));

    expect(res.status).toBe(204);

    // Project should be hidden from subsequent list
    const listRes = await request(app).get('/projects').set(bearerHeader(token));
    expect(listRes.body.total).toBe(0);
  });

  it('DELETE /projects/:id — returns 403 for non-admin', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma);
    await createMembership(testPrisma, user.id, org.id, OrgRole.member);
    const project = await createProject(testPrisma, org.id);
    const token = makeAccessToken(user.id, org.id, 'member', user.email);

    const res = await request(app)
      .delete(`/projects/${project.id}`)
      .set(bearerHeader(token));

    expect(res.status).toBe(403);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/projects');
    expect(res.status).toBe(401);
  });

  it('GET /projects/:id/dashboard — returns task counts by status', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma);
    await createMembership(testPrisma, user.id, org.id);
    const project = await createProject(testPrisma, org.id);
    const token = makeAccessToken(user.id, org.id, 'member', user.email);

    // Create tasks with different statuses
    await testPrisma.task.createMany({
      data: [
        { projectId: project.id, creatorId: user.id, title: 'T1', status: 'todo', priority: 'medium' },
        { projectId: project.id, creatorId: user.id, title: 'T2', status: 'todo', priority: 'medium' },
        { projectId: project.id, creatorId: user.id, title: 'T3', status: 'done', priority: 'medium' },
      ],
    });

    const res = await request(app)
      .get(`/projects/${project.id}/dashboard`)
      .set(bearerHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.taskCounts.todo).toBe(2);
    expect(res.body.taskCounts.done).toBe(1);
    expect(res.body.taskCounts.in_progress).toBe(0);
  });
});
