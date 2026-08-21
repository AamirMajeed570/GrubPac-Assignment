/**
 * Test data factories.
 * Build realistic entities for use in tests without hitting
 * external services.
 */

import { PrismaClient, OrgRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export interface TestUser {
  id: string;
  name: string;
  email: string;
  password: string; // plaintext — for login tests
  passwordHash: string;
}

export interface TestOrg {
  id: string;
  name: string;
  slug: string;
}

let counter = 0;
function uid() {
  return `${Date.now()}-${++counter}`;
}

export async function createUser(
  prisma: PrismaClient,
  overrides: Partial<{ name: string; email: string; password: string }> = {}
): Promise<TestUser> {
  const password = overrides.password ?? 'Password123!';
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const id = uid();
  const user = await prisma.user.create({
    data: {
      name: overrides.name ?? `Test User ${id}`,
      email: overrides.email ?? `user-${id}@test.com`,
      passwordHash,
    },
  });
  return { ...user, password, passwordHash: user.passwordHash };
}

export async function createOrg(
  prisma: PrismaClient,
  overrides: Partial<{ name: string; slug: string }> = {}
): Promise<TestOrg> {
  const id = uid();
  return prisma.organization.create({
    data: {
      name: overrides.name ?? `Test Org ${id}`,
      slug: overrides.slug ?? `test-org-${id}`,
    },
  });
}

export async function createMembership(
  prisma: PrismaClient,
  userId: string,
  organizationId: string,
  role: OrgRole = OrgRole.member
) {
  return prisma.orgMember.create({
    data: { userId, organizationId, role },
  });
}

export async function createProject(
  prisma: PrismaClient,
  organizationId: string,
  overrides: Partial<{ name: string; description: string }> = {}
) {
  const id = uid();
  return prisma.project.create({
    data: {
      organizationId,
      name: overrides.name ?? `Project ${id}`,
      description: overrides.description,
    },
  });
}

export async function createTask(
  prisma: PrismaClient,
  projectId: string,
  creatorId: string,
  overrides: Partial<{
    title: string;
    description: string;
    status: 'todo' | 'in_progress' | 'review' | 'done';
    priority: 'low' | 'medium' | 'high' | 'urgent';
  }> = {}
) {
  const id = uid();
  return prisma.task.create({
    data: {
      projectId,
      creatorId,
      title: overrides.title ?? `Task ${id}`,
      description: overrides.description,
      status: overrides.status ?? 'todo',
      priority: overrides.priority ?? 'medium',
    },
  });
}
