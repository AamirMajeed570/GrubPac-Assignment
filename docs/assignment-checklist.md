# TaskFlow — Assignment Requirement Checklist

## Task 01 — Data Modeling & Database Design

- [x] `users` table — `prisma/schema.prisma`, `prisma/migrations/20240821000001_init/migration.sql`
- [x] `organizations` table
- [x] `org_members` table
- [x] `projects` table
- [x] `tasks` table
- [x] `task_assignments` table
- [x] `comments` table
- [x] `refresh_tokens` table (required by auth implementation)
- [x] Proper foreign keys with CASCADE/RESTRICT decisions — documented in `migration.sql` and `docs/architecture.md`
- [x] Projects reference organizations
- [x] Tasks reference projects
- [x] task_assignments reference both tasks and users
- [x] Comments reference both tasks and users (author)
- [x] PostgreSQL enum `TaskStatus`: `todo`, `in_progress`, `review`, `done`
- [x] PostgreSQL enum `TaskPriority`: `low`, `medium`, `high`, `urgent`
- [x] PostgreSQL enum `OrgRole`: `org_admin`, `member`
- [x] Indexes on frequently queried columns — justified in `migration.sql` comments
- [x] Migration files — no manually maintained schema.sql
- [x] Migration up/down support — `prisma migrate dev` (down via `prisma migrate reset`)
- [x] Seed: 2 organizations — `prisma/seed.ts`
- [x] Seed: 5 users
- [x] Seed: Multiple projects (4 projects across 2 orgs)
- [x] Seed: 10+ tasks (14 tasks)
- [x] Seed: Tasks distributed across projects
- [x] Seed: Different statuses and priorities
- [x] Seed: Assignments and sample comments
- [x] ★ Soft delete `deleted_at` on projects and tasks
- [x] ★ PostgreSQL full-text search — GIN index on `search_vector` generated column

## Task 02 — Authentication & Authorization

- [x] `POST /auth/register` — `src/modules/auth/auth.routes.ts`
- [x] `POST /auth/login`
- [x] `POST /auth/refresh`
- [x] `POST /auth/logout`
- [x] bcrypt password hashing — `src/utils/password.ts`
- [x] bcrypt cost factor ≥ 12 (`SALT_ROUNDS = 12`)
- [x] JWT access token — `src/utils/jwt.ts`
- [x] Access token TTL = 15 minutes
- [x] Refresh token TTL = 7 days
- [x] Refresh tokens stored in DB (`refresh_tokens` table) with hash
- [x] Refresh token revocation support (`revokedAt` column)
- [x] Roles: `org_admin`, `member`
- [x] Admins can manage members — `src/modules/organizations/organization.routes.ts`
- [x] Admins can delete projects — `src/modules/projects/project.routes.ts` (`requireRole('org_admin')`)
- [x] JWT middleware attaches user + org context — `src/middleware/auth.middleware.ts`
- [x] All service queries scoped by `org_id` from JWT (never client-provided)
- [x] Cross-tenant access → 403/404 — `src/modules/projects/project.service.ts`, `src/modules/tasks/task.service.ts`
- [x] Auth endpoints rate-limited: 10 req/min/IP — `src/middleware/rateLimit.middleware.ts`
- [x] ★ Refresh token rotation — `src/modules/auth/auth.service.ts` (`refresh()`)
- [x] ★ Logout all devices — `POST /auth/logout-all`

## Task 03 — REST API — Projects & Tasks

- [x] Full CRUD for projects — `src/modules/projects/`
- [x] Full CRUD for tasks — `src/modules/tasks/`
- [x] Every project scoped to authenticated user's org
- [x] Every task scoped to a project within authenticated user's org
- [x] Task filters: status, priority, assignee, due-date range — `src/modules/tasks/task.service.ts`
- [x] Offset pagination with `{ data, total, page, limit }` — `src/utils/pagination.ts`
- [x] Zod validation for all request bodies and query params
- [x] Consistent error responses `{ error, code, details }`
- [x] `POST /tasks/:id/assign` — assign user to task
- [x] `DELETE /tasks/:id/assign/:userId` — unassign user from task
- [x] Assigned user must belong to same org
- [x] Project dashboard with task counts grouped by status — `GET /projects/:id/dashboard`
- [x] ★ Bulk task status update — `POST /tasks/bulk-status`
- [x] ★ Full-text task search via `search` query param

## Task 04 — Background Jobs & Email Notifications

- [x] Redis + BullMQ — `src/queue/queues.ts`, `src/queue/connection.ts`
- [x] Assignment endpoint persists assignment then enqueues job before returning — `src/modules/tasks/task.service.ts`
- [x] Email processing async in worker, does not block API — `worker/email.worker.ts`
- [x] Consistency strategy documented: persist-first, best-effort enqueue — `docs/architecture.md`
- [x] Worker processes email jobs — `worker/worker.ts`, `worker/email.worker.ts`
- [x] Mock email sending (logs to console)
- [x] Retry failed jobs 3 times — queue `defaultJobOptions.attempts: 3`
- [x] Exponential backoff: 1s → 2s → 4s — `backoff: { type: 'exponential', delay: 1000 }`
- [x] Failed jobs after 3 retries → dead-letter queue — `worker/email.worker.ts` (failed handler)
- [x] `GET /jobs/:id` — `src/modules/jobs/`
- [x] Supported statuses: `pending`, `active`, `completed`, `failed`
- [x] Docker Compose starts API + Worker + PostgreSQL + Redis — `docker-compose.yml`

## Task 05 — Testing & API Documentation

### Unit Tests

- [x] Authentication logic (password hashing/comparison) — `tests/unit/password.test.ts`
- [x] JWT signing/verification — `tests/unit/jwt.test.ts`
- [x] Task assignment validation — `tests/unit/task-assignment-validation.test.ts`
- [x] Pagination helper — `tests/unit/pagination.test.ts`
- [x] Error utilities — `tests/unit/errors.test.ts`

### Integration Tests

- [x] Login flow — `tests/integration/auth.test.ts`
- [x] Task CRUD — `tests/integration/tasks.test.ts`
- [x] Cross-tenant access → 403/404 — `tests/integration/cross-tenant.test.ts`
- [x] Validation/error scenarios — `tests/integration/validation.test.ts`
- [x] ★ Test that task assignment creates a queue job — `tests/integration/job-queue.test.ts`

### Test Isolation

- [x] Dedicated test database (`TEST_DATABASE_URL`) — `tests/helpers/db.ts`
- [x] `cleanDatabase()` in `beforeEach` via `TRUNCATE ... CASCADE`

### API Documentation

- [x] OpenAPI / Swagger spec — `docs/openapi.yaml`
- [x] Swagger UI accessible locally at `http://localhost:3000/api-docs`
- [x] Postman collection — `docs/TaskFlow.postman_collection.json`
- [x] Collection imports and works without manual edits (uses variables)

## Submission

- [x] Working Docker setup — `docker-compose.yml`, `Dockerfile`
- [x] Clear README — `README.md`
- [x] Technical decisions documented — `docs/architecture.md`
- [x] Architecture document — `docs/architecture.md`
- [x] Environment variable documentation — `.env.example`

## Bonus Features Implemented

- [x] ★ Soft delete on projects and tasks (`deleted_at`)
- [x] ★ PostgreSQL full-text search on tasks (GIN index + `search` filter)
- [x] ★ Refresh token rotation
- [x] ★ Logout all devices (`POST /auth/logout-all`)
- [x] ★ Bulk task status update (`POST /tasks/bulk-status`)
- [x] ★ Test that task assignment creates a queue job

## Bonus Features Not Implemented

- [ ] Deduplication of assignments within 5 seconds (would require Redis TTL key check)
- [ ] Global email rate limit (50 emails/minute) (would require Redis sliding window counter)
- [ ] Coverage report (can be generated via `npm run test:coverage`)
