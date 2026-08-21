# TaskFlow — Architecture Document

## System Overview

TaskFlow is a multi-tenant project management backend. Users belong to organizations, create projects, manage tasks, assign work, and receive asynchronous email notifications.

```
┌──────────────────────────────────────┐
│           Client (HTTP/REST)          │
└─────────────────┬────────────────────┘
                  │
┌─────────────────▼────────────────────┐
│             Express API               │
│  (auth, organizations, projects,      │
│   tasks, assignments, jobs)           │
└──────┬──────────────────────┬────────┘
       │                      │
┌──────▼──────┐        ┌──────▼──────┐
│  PostgreSQL  │        │    Redis    │
│  (Prisma)    │        │  (BullMQ)  │
└─────────────┘        └──────┬──────┘
                               │
                        ┌──────▼──────┐
                        │   Worker    │
                        │ (email proc)│
                        └─────────────┘
```

---

## Components

| Component    | Responsibility |
|--------------|----------------|
| **API**      | HTTP request handling, validation, business logic, multi-tenant scoping |
| **Worker**   | Processes email notification jobs from the BullMQ queue |
| **PostgreSQL** | Persistent storage for all application data |
| **Redis**    | BullMQ job queue (email notifications, DLQ) + rate limit counters |

---

## Layered Architecture

```
Request
  │
  ▼
Route          — Express router (URL + HTTP method)
  │
  ▼
Middleware     — requireAuth(), requireRole(), rateLimit()
  │
  ▼
Controller     — Thin: parse/validate input, call service, return response
  │
  ▼
Validation     — Zod schemas (request body, query params)
  │
  ▼
Service        — Business logic, multi-tenant scoping, queue interactions
  │
  ▼
Prisma Client  — Type-safe ORM queries
  │
  ▼
PostgreSQL
```

---

## Authentication Flow

```
POST /auth/login
  │
  ├─ Verify email + bcrypt password (cost 12)
  ├─ Load first org membership from DB
  ├─ Sign JWT access token (15 min, includes orgId + role)
  ├─ Sign JWT refresh token (7 days, includes userId + jti)
  ├─ Store hashed refresh token in refresh_tokens table
  └─ Return { user, tokens }

Subsequent requests:
  Authorization: Bearer <accessToken>
  │
  ├─ requireAuth middleware verifies JWT signature
  ├─ Attaches { userId, orgId, role, email } to req.user
  └─ orgId comes from JWT — never from client body/query
```

---

## Multi-Tenant Authorization Flow

```
GET /projects/:id
  │
  ├─ requireAuth → req.user.orgId = "org-A"
  │
  └─ ProjectService.getById("org-A", projectId)
       │
       └─ prisma.project.findFirst({
            where: {
              id: projectId,
              organizationId: "org-A",  ← always scoped
              deletedAt: null
            }
          })
         │
         ├─ Found → return project
         └─ Not found → throw 404 (cross-tenant: also 404, not 403,
                         to avoid confirming resource existence)
```

**Key invariant:** The `orgId` used in every service-layer query comes exclusively from `req.user.orgId` (set by JWT middleware from a signed token). Client-supplied `org_id` values are never trusted.

---

## Task Assignment Flow

```
POST /tasks/:taskId/assign  { userId }
  │
  ├─ 1. Verify task exists in authenticated org (404 if not)
  ├─ 2. Verify target user is a member of same org (403 if not)
  ├─ 3. Check for duplicate assignment (409 if exists)
  ├─ 4. INSERT task_assignment (committed to DB)
  ├─ 5. Enqueue email job to BullMQ (best-effort)
  │       └─ If enqueue fails: log error, do NOT roll back assignment
  └─ 6. Return { assignment, jobId }
```

### Consistency Strategy

**Approach:** Persist-first, enqueue-second, best-effort notifications.

The task assignment is the source of truth. Losing a notification is acceptable; losing the assignment record is not. If enqueueing fails, the assignment is still valid and a future reconciliation job could replay missed notifications by scanning `task_assignments` without a corresponding completed email job.

This avoids distributed transaction complexity (2PC) while maintaining assignment integrity.

---

## BullMQ / Worker Flow

```
API enqueues job:
  emailQueue.add('send-email', {
    type: 'TASK_ASSIGNED',
    to, assigneeName, taskTitle, ...
  })

Worker (separate process):
  Worker listens on 'email-notifications' queue
  │
  ├─ processEmailJob(job)
  │     └─ Mock: log email content (replace with Nodemailer/SES in prod)
  │
  ├─ On success: job → completed
  │
  └─ On failure:
        ├─ Retry up to 3 times with exponential backoff (1s → 2s → 4s)
        └─ After 3 failures: move to DLQ ('email-notifications-dlq')
                             job status → failed
```

---

## Retry / Dead Letter Queue Strategy

| Attempt | Delay |
|---------|-------|
| 1st retry | 1 second |
| 2nd retry | 2 seconds |
| 3rd retry | 4 seconds |
| After 3 failures | Moved to `email-notifications-dlq` |

The `GET /jobs/:id` endpoint checks the main queue first, then the DLQ, and maps BullMQ job states to `pending | active | completed | failed`.

---

## Database Relationships

```
organizations
  └── org_members (userId, organizationId, role)
  └── projects
        └── tasks
              └── task_assignments (taskId, userId)
              └── comments (taskId, authorId)

users
  └── org_members
  └── refresh_tokens
  └── task_assignments
  └── comments
  └── tasks (as creator)
```

### FK / Cascade Decisions

| Relationship | Strategy | Reason |
|---|---|---|
| org → membership | CASCADE | Deleting org removes all memberships |
| user → membership | RESTRICT | Cannot delete a user still in an org |
| org → project | CASCADE | Org removal cascades to projects |
| project → task | CASCADE | Deleting a project removes its tasks |
| task → assignment | CASCADE | Removing a task clears assignments |
| user → assignment | RESTRICT | Cannot delete a user with assignments |
| task → comment | CASCADE | Removing a task removes its comments |
| user → comment | RESTRICT | Cannot delete users who authored comments |
| user → refresh_token | CASCADE | Deleting user clears tokens |

---

## Soft Delete

Projects and tasks use `deleted_at TIMESTAMP NULL`. All queries filter `WHERE deleted_at IS NULL`. Hard deletes are never performed from the API.

---

## Full-Text Search

Tasks include a PostgreSQL generated `tsvector` column over `title || description`, indexed with a GIN index. The API uses `ILIKE` for simplicity (compatible with Prisma's `contains` mode). Raw `tsvector` search can be applied via a Prisma `$queryRaw` if needed.

---

## Important Technical Decisions

| Decision | Choice | Reason |
|---|---|---|
| ORM | Prisma | Type-safe, excellent migration tooling, auto-generated client |
| Auth | JWT (stateless access) + hashed refresh tokens in DB | Balance of stateless performance and revocability |
| Refresh token storage | Hash (SHA-256) in DB | Raw token never stored — DB leak can't replay tokens |
| Multi-org users | First membership used | Satisfies assignment; multi-org switching is out of scope |
| Soft delete | `deleted_at` on projects/tasks | Recoverable, avoids cascade ambiguity |
| Error format | `{ error, code, details }` | Consistent, client-parseable, no stack traces |
| Queue consistency | Persist-first, best-effort enqueue | Simpler than 2PC; assignment integrity > notification delivery |
| Test isolation | Dedicated test DB + TRUNCATE in beforeEach | Fast, reliable, no transaction weirdness with Prisma |
