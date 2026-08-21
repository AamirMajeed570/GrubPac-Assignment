/**
 * Test database helper.
 *
 * Isolation strategy: dedicated test database (TEST_DATABASE_URL).
 * Each test file truncates the tables it needs inside beforeEach,
 * ensuring a clean slate without needing transactions or spinning up
 * a new DB per test.
 *
 * To use:
 *   import { getTestPrisma, cleanDatabase } from '../helpers/db';
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const testDatabaseUrl = process.env['TEST_DATABASE_URL'] ?? process.env['DATABASE_URL'];

if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL (or DATABASE_URL) must be set to run integration tests'
  );
}

export const testPrisma = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
  log: [],
});

/**
 * Truncate all tables in dependency-safe order.
 * Call this in beforeEach to guarantee isolation.
 */
export async function cleanDatabase(): Promise<void> {
  // Order: children first, then parents
  await testPrisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "comments",
      "task_assignments",
      "tasks",
      "projects",
      "refresh_tokens",
      "org_members",
      "users",
      "organizations"
    RESTART IDENTITY CASCADE
  `);
}

export async function disconnectTestDb(): Promise<void> {
  await testPrisma.$disconnect();
}
