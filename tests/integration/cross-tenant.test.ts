/**
 * Integration tests — Cross-tenant isolation.
 *
 * CRITICAL: Proves that a user from Org A cannot access resources
 * belonging to Org B.
 *
 * Every test in this file expects HTTP 403 or 404 (resource not found
 * is also acceptable — it must NOT return the resource data).
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

// Suppress queue calls
jest.mock('../../src/queue/queues', () => ({
  getEmailQueue: jest.fn(() => ({
    add: jest.fn().mockResolvedValue({ id: 'mock-job' }),
  })),
  getEmailDlq: jest.fn(() => ({
    add: jest.fn(),
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

// Helper: set up two isolated orgs with one user each
async function setupTwoOrgs() {
  const orgA = await createOrg(testPrisma, { name: 'Org A', slug: `org-a-${Date.now()}` });
  const orgB = await createOrg(testPrisma, { name: 'Org B', slug: `org-b-${Date.now()}` });

  const userA = await createUser(testPrisma, { email: `usera-${Date.now()}@test.com` });
  const userB = await createUser(testPrisma, { email: `userb-${Date.now()}@test.com` });

  await createMembership(testPrisma, userA.id, orgA.id);
  await createMembership(testPrisma, userB.id, orgB.id);

  const tokenA = makeAccessToken(userA.id, orgA.id, 'member', userA.email);
  const tokenB = makeAccessToken(userB.id, orgB.id, 'member', userB.email);

  return { orgA, orgB, userA, userB, tokenA, tokenB };
}

describe('Cross-tenant access — Projects', () => {
  it('User from Org A cannot read Org B project (GET /projects/:id → 404)', async () => {
    const { orgB, userB, tokenA } = await setupTwoOrgs();
    const projectB = await createProject(testPrisma, orgB.id, { name: "Org B's Secret Project" });

    // userA with tokenA tries to read orgB's project
    const res = await request(app)
      .get(`/projects/${projectB.id}`)
      .set(bearerHeader(tokenA));

    // Must NOT expose resource data — 404 is acceptable (scoped query returns nothing)
    expect([403, 404]).toContain(res.status);
    // Must not leak the project name
    expect(JSON.stringify(res.body)).not.toContain("Org B's Secret Project");
  });

  it('User from Org A cannot update Org B project (PATCH /projects/:id → 404)', async () => {
    const { orgB, tokenA } = await setupTwoOrgs();
    const projectB = await createProject(testPrisma, orgB.id);

    const res = await request(app)
      .patch(`/projects/${projectB.id}`)
      .set(bearerHeader(tokenA))
      .send({ name: 'Hijacked' });

    expect([403, 404]).toContain(res.status);
  });

  it('User from Org A cannot delete Org B project (DELETE /projects/:id → 403/404)', async () => {
    const { orgB, userA, orgA, tokenB } = await setupTwoOrgs();
    // Give userA admin rights in orgA
    await testPrisma.orgMember.updateMany({
      where: { userId: userA.id, organizationId: orgA.id },
      data: { role: 'org_admin' },
    });
    const adminTokenA = makeAccessToken(userA.id, orgA.id, 'org_admin', `admin-${Date.now()}@test.com`);

    const projectB = await createProject(testPrisma, orgB.id);

    const res = await request(app)
      .delete(`/projects/${projectB.id}`)
      .set(bearerHeader(adminTokenA));

    expect([403, 404]).toContain(res.status);
  });

  it('Org B projects do NOT appear in Org A project list', async () => {
    const { orgA, orgB, userA, tokenA } = await setupTwoOrgs();
    await createProject(testPrisma, orgB.id, { name: 'Org B Only' });
    await createProject(testPrisma, orgA.id, { name: 'Org A Only' });

    const res = await request(app)
      .get('/projects')
      .set(bearerHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].name).toBe('Org A Only');
    expect(JSON.stringify(res.body)).not.toContain('Org B Only');
  });
});

describe('Cross-tenant access — Tasks', () => {
  it('User from Org A cannot read Org B task (GET /tasks/:id → 404)', async () => {
    const { orgB, userB, tokenA } = await setupTwoOrgs();
    const projectB = await createProject(testPrisma, orgB.id);
    const taskB = await createTask(testPrisma, projectB.id, userB.id, { title: 'Secret Task' });

    const res = await request(app)
      .get(`/tasks/${taskB.id}`)
      .set(bearerHeader(tokenA));

    expect([403, 404]).toContain(res.status);
    expect(JSON.stringify(res.body)).not.toContain('Secret Task');
  });

  it('User from Org A cannot update Org B task (PATCH /tasks/:id → 404)', async () => {
    const { orgB, userB, tokenA } = await setupTwoOrgs();
    const projectB = await createProject(testPrisma, orgB.id);
    const taskB = await createTask(testPrisma, projectB.id, userB.id);

    const res = await request(app)
      .patch(`/tasks/${taskB.id}`)
      .set(bearerHeader(tokenA))
      .send({ title: 'Hijacked Title' });

    expect([403, 404]).toContain(res.status);
  });

  it('User from Org A cannot assign themselves to Org B task', async () => {
    const { orgA, orgB, userA, userB, tokenA } = await setupTwoOrgs();
    const projectB = await createProject(testPrisma, orgB.id);
    const taskB = await createTask(testPrisma, projectB.id, userB.id);

    const res = await request(app)
      .post(`/tasks/${taskB.id}/assign`)
      .set(bearerHeader(tokenA))
      .send({ userId: userA.id });

    // Task not found in org A → 404; or cross-org assignment → 403
    expect([403, 404]).toContain(res.status);
  });

  it('User from Org A cannot assign Org B user to their own task', async () => {
    const { orgA, orgB, userA, userB, tokenA } = await setupTwoOrgs();
    const projectA = await createProject(testPrisma, orgA.id);
    const taskA = await createTask(testPrisma, projectA.id, userA.id);

    const res = await request(app)
      .post(`/tasks/${taskA.id}/assign`)
      .set(bearerHeader(tokenA))
      .send({ userId: userB.id }); // userB is in org B, not org A

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });
});

describe('Cross-tenant access — Validation error format', () => {
  it('returns consistent error structure on cross-tenant attempt', async () => {
    const { orgB, userB, tokenA } = await setupTwoOrgs();
    const projectB = await createProject(testPrisma, orgB.id);

    const res = await request(app)
      .get(`/projects/${projectB.id}`)
      .set(bearerHeader(tokenA));

    // Error response must follow { error, code, details } shape
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('code');
    expect(res.body).toHaveProperty('details');
  });
});
