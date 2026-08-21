/**
 * Integration tests — Authentication flow.
 *
 * Tests: register, login, refresh, logout, rate limiting boundaries.
 * Isolation: cleanDatabase() in beforeEach via dedicated test DB.
 */

import request from 'supertest';
import { createApp } from '../../src/app';
import { testPrisma, cleanDatabase, disconnectTestDb } from '../helpers/db';
import { createOrg } from '../helpers/factories';

const app = createApp();

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe('POST /auth/register', () => {
  it('registers a new user and returns tokens + user info', async () => {
    const org = await createOrg(testPrisma);

    const res = await request(app).post('/auth/register').send({
      name: 'Alice',
      email: 'alice@test.com',
      password: 'Password123!',
      organizationId: org.id,
    });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('alice@test.com');
    expect(res.body.user.organizationId).toBe(org.id);
    expect(res.body.tokens.accessToken).toBeDefined();
    expect(res.body.tokens.refreshToken).toBeDefined();
    // Password must NOT be returned
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('returns 409 when email is already registered', async () => {
    const org = await createOrg(testPrisma);
    const payload = {
      name: 'Bob',
      email: 'bob@test.com',
      password: 'Password123!',
      organizationId: org.id,
    };
    await request(app).post('/auth/register').send(payload);
    const res = await request(app).post('/auth/register').send(payload);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('returns 422 on missing required fields', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'incomplete@test.com',
    });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for unknown organizationId', async () => {
    const res = await request(app).post('/auth/register').send({
      name: 'Ghost',
      email: 'ghost@test.com',
      password: 'Password123!',
      organizationId: '00000000-0000-0000-0000-000000000000',
    });
    expect(res.status).toBe(404);
  });
});

describe('POST /auth/login', () => {
  it('returns tokens for valid credentials', async () => {
    const org = await createOrg(testPrisma);
    await request(app).post('/auth/register').send({
      name: 'Carol',
      email: 'carol@test.com',
      password: 'Password123!',
      organizationId: org.id,
    });

    const res = await request(app).post('/auth/login').send({
      email: 'carol@test.com',
      password: 'Password123!',
    });

    expect(res.status).toBe(200);
    expect(res.body.tokens.accessToken).toBeDefined();
    expect(res.body.tokens.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe('carol@test.com');
  });

  it('returns 401 for wrong password', async () => {
    const org = await createOrg(testPrisma);
    await request(app).post('/auth/register').send({
      name: 'Dan',
      email: 'dan@test.com',
      password: 'RightPassword1!',
      organizationId: org.id,
    });

    const res = await request(app).post('/auth/login').send({
      email: 'dan@test.com',
      password: 'WrongPassword!',
    });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for non-existent email', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'nobody@test.com',
      password: 'DoesntMatter1!',
    });
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/refresh', () => {
  it('returns new tokens given a valid refresh token', async () => {
    const org = await createOrg(testPrisma);
    const registerRes = await request(app).post('/auth/register').send({
      name: 'Eve',
      email: 'eve@test.com',
      password: 'Password123!',
      organizationId: org.id,
    });
    const { refreshToken } = registerRes.body.tokens;

    const res = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    // Token rotation: new refresh token should differ from old
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  it('returns 401 for an invalid refresh token', async () => {
    const res = await request(app).post('/auth/refresh').send({ refreshToken: 'bogus' });
    expect(res.status).toBe(401);
  });

  it('returns 401 when reusing a rotated (revoked) refresh token', async () => {
    const org = await createOrg(testPrisma);
    const registerRes = await request(app).post('/auth/register').send({
      name: 'Frank',
      email: 'frank@test.com',
      password: 'Password123!',
      organizationId: org.id,
    });
    const { refreshToken } = registerRes.body.tokens;

    // Use once — rotates the token
    await request(app).post('/auth/refresh').send({ refreshToken });

    // Reuse the old token — must be rejected
    const res = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('revokes the refresh token and returns 204', async () => {
    const org = await createOrg(testPrisma);
    const registerRes = await request(app).post('/auth/register').send({
      name: 'Grace',
      email: 'grace@test.com',
      password: 'Password123!',
      organizationId: org.id,
    });
    const { refreshToken } = registerRes.body.tokens;

    const res = await request(app).post('/auth/logout').send({ refreshToken });
    expect(res.status).toBe(204);

    // Subsequent refresh with that token must fail
    const retryRes = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(retryRes.status).toBe(401);
  });
});
