/**
 * Seed script — creates realistic demo data:
 *   2 organizations, 5 users, multiple projects, 10+ tasks,
 *   assignments, and sample comments.
 *
 * Run with: npm run prisma:seed
 */

import { PrismaClient, TaskStatus, TaskPriority, OrgRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

async function main() {
  console.log('🌱 Seeding database...');

  // ── Clean existing data (order matters due to FKs) ──────────────────
  await prisma.comment.deleteMany();
  await prisma.taskAssignment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.orgMember.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // ── Organizations ───────────────────────────────────────────────────
  const [acme, nexus] = await Promise.all([
    prisma.organization.create({
      data: { name: 'Acme Corp', slug: 'acme-corp' },
    }),
    prisma.organization.create({
      data: { name: 'Nexus Labs', slug: 'nexus-labs' },
    }),
  ]);
  console.log(`✔ Created organizations: ${acme.name}, ${nexus.name}`);

  // ── Users ───────────────────────────────────────────────────────────
  const password = await bcrypt.hash('Password123!', SALT_ROUNDS);

  const [alice, bob, carol, dan, eve] = await Promise.all([
    prisma.user.create({ data: { name: 'Alice Admin',  email: 'alice@acme.com',  passwordHash: password } }),
    prisma.user.create({ data: { name: 'Bob Builder',  email: 'bob@acme.com',    passwordHash: password } }),
    prisma.user.create({ data: { name: 'Carol Coder',  email: 'carol@acme.com',  passwordHash: password } }),
    prisma.user.create({ data: { name: 'Dan Dev',      email: 'dan@nexus.com',   passwordHash: password } }),
    prisma.user.create({ data: { name: 'Eve Engineer', email: 'eve@nexus.com',   passwordHash: password } }),
  ]);
  console.log('✔ Created 5 users (password: Password123!)');

  // ── Org Memberships ─────────────────────────────────────────────────
  await Promise.all([
    // Acme: alice = admin, bob + carol = members
    prisma.orgMember.create({ data: { userId: alice.id, organizationId: acme.id, role: OrgRole.org_admin } }),
    prisma.orgMember.create({ data: { userId: bob.id,   organizationId: acme.id, role: OrgRole.member } }),
    prisma.orgMember.create({ data: { userId: carol.id, organizationId: acme.id, role: OrgRole.member } }),
    // Nexus: dan = admin, eve = member
    prisma.orgMember.create({ data: { userId: dan.id,   organizationId: nexus.id, role: OrgRole.org_admin } }),
    prisma.orgMember.create({ data: { userId: eve.id,   organizationId: nexus.id, role: OrgRole.member } }),
  ]);
  console.log('✔ Created org memberships');

  // ── Projects ────────────────────────────────────────────────────────
  const [website, mobileApp, api, platform] = await Promise.all([
    prisma.project.create({ data: { organizationId: acme.id, name: 'Website Redesign', description: 'Redesign the corporate website with modern UI/UX' } }),
    prisma.project.create({ data: { organizationId: acme.id, name: 'Mobile App v2',    description: 'Second iteration of the mobile application' } }),
    prisma.project.create({ data: { organizationId: nexus.id, name: 'Core API',        description: 'RESTful API for the Nexus platform' } }),
    prisma.project.create({ data: { organizationId: nexus.id, name: 'Data Platform',   description: 'Internal analytics and data pipeline' } }),
  ]);
  console.log('✔ Created 4 projects');

  // ── Tasks ────────────────────────────────────────────────────────────
  const now = new Date();
  const daysFromNow = (d: number) => new Date(now.getTime() + d * 86_400_000);

  const tasks = await Promise.all([
    // Website Redesign tasks (Acme)
    prisma.task.create({ data: { projectId: website.id, creatorId: alice.id, title: 'Create wireframes',          description: 'Design low-fidelity wireframes for all pages',    status: TaskStatus.done,        priority: TaskPriority.high,   dueDate: daysFromNow(-10) } }),
    prisma.task.create({ data: { projectId: website.id, creatorId: alice.id, title: 'Set up design system',       description: 'Configure Tailwind and component library',          status: TaskStatus.done,        priority: TaskPriority.high,   dueDate: daysFromNow(-5) } }),
    prisma.task.create({ data: { projectId: website.id, creatorId: bob.id,   title: 'Implement homepage',         description: 'Code the new homepage layout',                      status: TaskStatus.in_progress, priority: TaskPriority.urgent, dueDate: daysFromNow(3) } }),
    prisma.task.create({ data: { projectId: website.id, creatorId: bob.id,   title: 'Implement contact form',     description: 'Add validated contact form with email integration', status: TaskStatus.todo,        priority: TaskPriority.medium, dueDate: daysFromNow(7) } }),
    prisma.task.create({ data: { projectId: website.id, creatorId: carol.id, title: 'SEO audit',                  description: 'Review and fix meta tags, sitemaps, robots.txt',   status: TaskStatus.review,      priority: TaskPriority.low,    dueDate: daysFromNow(14) } }),

    // Mobile App v2 tasks (Acme)
    prisma.task.create({ data: { projectId: mobileApp.id, creatorId: alice.id, title: 'Auth screens',             description: 'Login, register, forgot password screens',          status: TaskStatus.done,        priority: TaskPriority.urgent, dueDate: daysFromNow(-7) } }),
    prisma.task.create({ data: { projectId: mobileApp.id, creatorId: bob.id,   title: 'Push notifications',       description: 'Integrate FCM for push notifications',              status: TaskStatus.in_progress, priority: TaskPriority.high,   dueDate: daysFromNow(5) } }),
    prisma.task.create({ data: { projectId: mobileApp.id, creatorId: carol.id, title: 'Offline mode',             description: 'Cache data for offline usage with SQLite',          status: TaskStatus.todo,        priority: TaskPriority.medium, dueDate: daysFromNow(21) } }),

    // Core API tasks (Nexus)
    prisma.task.create({ data: { projectId: api.id, creatorId: dan.id,  title: 'Rate limiting',                   description: 'Implement per-IP rate limiting with Redis',         status: TaskStatus.done,        priority: TaskPriority.high,   dueDate: daysFromNow(-3) } }),
    prisma.task.create({ data: { projectId: api.id, creatorId: dan.id,  title: 'API versioning',                  description: 'Add /v1/ prefix and deprecation headers',           status: TaskStatus.in_progress, priority: TaskPriority.medium, dueDate: daysFromNow(4) } }),
    prisma.task.create({ data: { projectId: api.id, creatorId: eve.id,  title: 'OpenAPI docs',                    description: 'Write complete OpenAPI 3.0 specification',          status: TaskStatus.review,      priority: TaskPriority.medium, dueDate: daysFromNow(6) } }),
    prisma.task.create({ data: { projectId: api.id, creatorId: eve.id,  title: 'Integration tests',               description: 'Cover all endpoints with Supertest integration tests', status: TaskStatus.todo,      priority: TaskPriority.high,   dueDate: daysFromNow(10) } }),

    // Data Platform tasks (Nexus)
    prisma.task.create({ data: { projectId: platform.id, creatorId: dan.id, title: 'ETL pipeline',                description: 'Build nightly ETL from production DB to warehouse', status: TaskStatus.in_progress, priority: TaskPriority.urgent, dueDate: daysFromNow(2) } }),
    prisma.task.create({ data: { projectId: platform.id, creatorId: eve.id, title: 'Dashboard mockup',            description: 'Design analytics dashboard in Figma',               status: TaskStatus.todo,        priority: TaskPriority.low,    dueDate: daysFromNow(30) } }),
  ]);
  console.log(`✔ Created ${tasks.length} tasks`);

  // ── Assignments ───────────────────────────────────────────────────────
  await Promise.all([
    // Acme assignments
    prisma.taskAssignment.create({ data: { taskId: tasks[2]!.id, userId: bob.id   } }),  // implement homepage → bob
    prisma.taskAssignment.create({ data: { taskId: tasks[2]!.id, userId: carol.id } }),  // implement homepage → carol (multiple)
    prisma.taskAssignment.create({ data: { taskId: tasks[3]!.id, userId: carol.id } }),  // contact form → carol
    prisma.taskAssignment.create({ data: { taskId: tasks[6]!.id, userId: bob.id   } }),  // push notifications → bob

    // Nexus assignments
    prisma.taskAssignment.create({ data: { taskId: tasks[9]!.id,  userId: eve.id  } }),  // api versioning → eve
    prisma.taskAssignment.create({ data: { taskId: tasks[10]!.id, userId: dan.id  } }),  // openapi docs → dan
    prisma.taskAssignment.create({ data: { taskId: tasks[12]!.id, userId: eve.id  } }),  // etl pipeline → eve
  ]);
  console.log('✔ Created task assignments');

  // ── Comments ──────────────────────────────────────────────────────────
  await Promise.all([
    prisma.comment.create({ data: { taskId: tasks[2]!.id, authorId: alice.id, body: 'Make sure to match the new brand guidelines.' } }),
    prisma.comment.create({ data: { taskId: tasks[2]!.id, authorId: bob.id,   body: 'Working on it — should be done by EOD Thursday.' } }),
    prisma.comment.create({ data: { taskId: tasks[4]!.id, authorId: carol.id, body: 'Found 12 missing meta descriptions. Fixing them now.' } }),
    prisma.comment.create({ data: { taskId: tasks[6]!.id, authorId: dan.id,   body: 'FCM credentials are in 1Password under mobile-prod.' } }),
    prisma.comment.create({ data: { taskId: tasks[9]!.id, authorId: dan.id,   body: 'Versioning strategy doc linked in Notion.' } }),
    prisma.comment.create({ data: { taskId: tasks[12]!.id, authorId: eve.id,  body: 'Staging pipeline is green. Promoting to prod Monday.' } }),
  ]);
  console.log('✔ Created sample comments');

  console.log('\n✅ Seed complete!');
  console.log('   Accounts (password: Password123!):');
  console.log('   alice@acme.com  — Acme Corp admin');
  console.log('   bob@acme.com    — Acme Corp member');
  console.log('   carol@acme.com  — Acme Corp member');
  console.log('   dan@nexus.com   — Nexus Labs admin');
  console.log('   eve@nexus.com   — Nexus Labs member');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
