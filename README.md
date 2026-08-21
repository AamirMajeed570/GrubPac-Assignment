# TaskFlow Backend

A lightweight project management API built with Node.js, TypeScript, Express, PostgreSQL, and BullMQ.

## Features

- **Multi-tenant** — complete organization isolation enforced at the service layer
- **Authentication** — JWT access tokens (15 min) + rotatable refresh tokens (7 days)
- **RBAC** — `org_admin` and `member` roles with enforced permissions
- **Full CRUD** — organizations, projects, tasks, comments
- **Task filters** — status, priority, assignee, due-date range, full-text search
- **Pagination** — offset-based with `{ data, total, page, limit }`
- **Background jobs** — BullMQ email notifications with retry + dead-letter queue
- **Soft delete** — projects and tasks are soft-deleted via `deleted_at`
- **API Docs** — Swagger UI at `/api-docs`, Postman collection included
- **Docker Compose** — one command to start everything

## Tech Stack

| Category | Technology |
|---|---|
| Language | TypeScript 5 / Node.js 20 |
| Framework | Express 4 |
| Database | PostgreSQL 16 |
| ORM | Prisma 5 |
| Job Queue | BullMQ + Redis 7 |
| Auth | JWT + bcrypt |
| Validation | Zod |
| Testing | Jest + Supertest |
| Containers | Docker Compose |
| API Docs | Swagger UI + OpenAPI 3 |

## Project Structure

```
taskflow/
├── src/
│   ├── config/          # env.ts, database.ts
│   ├── middleware/       # auth, rbac, rateLimit, error
│   ├── modules/
│   │   ├── auth/        # register, login, refresh, logout
│   │   ├── organizations/
│   │   ├── projects/
│   │   ├── tasks/
│   │   ├── jobs/
│   │   ├── health/
│   │   └── docs/        # Swagger setup
│   ├── queue/           # BullMQ connection, queues, job types
│   ├── utils/           # errors, jwt, password, pagination, logger
│   ├── app.ts
│   └── server.ts
├── worker/
│   ├── worker.ts        # Entry point
│   └── email.worker.ts  # Email processor
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── helpers/
├── docs/
│   ├── openapi.yaml
│   ├── architecture.md
│   ├── assignment-checklist.md
│   └── TaskFlow.postman_collection.json
├── docker-compose.yml
└── Dockerfile
```

## Local Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 16 running locally
- Redis 7 running locally

### 1. Clone and install

```bash
git clone <repo-url>
cd taskflow
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL, TEST_DATABASE_URL, JWT secrets
```

### 3. Run migrations

```bash
npx prisma migrate deploy
```

### 4. Seed the database

```bash
npm run prisma:seed
```

Seed creates:
- **Acme Corp** — `alice@acme.com` (admin), `bob@acme.com`, `carol@acme.com`
- **Nexus Labs** — `dan@nexus.com` (admin), `eve@nexus.com`
- Password for all accounts: `Password123!`

### 5. Start the API

```bash
npm run dev
```

### 6. Start the Worker (separate terminal)

```bash
npm run worker
```

API runs at `http://localhost:3000`
Swagger UI at `http://localhost:3000/api-docs`

## Docker Setup

```bash
# Start all services (API, Worker, PostgreSQL, Redis)
docker compose up --build

# Run with seed data
docker compose up --build
# In a separate terminal after containers are healthy:
docker compose exec api node dist/prisma/seed.js
```

Services:
- API: `http://localhost:3000`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## Database Migrations

```bash
# Development (creates migration files)
npx prisma migrate dev --name <migration-name>

# Production / Docker (applies existing migrations)
npx prisma migrate deploy

# Reset database (dev only)
npx prisma migrate reset

# View schema in browser
npx prisma studio
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Node environment |
| `PORT` | No | `3000` | API port |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `TEST_DATABASE_URL` | No | Same as DATABASE_URL | Test database |
| `REDIS_HOST` | No | `localhost` | Redis host |
| `REDIS_PORT` | No | `6379` | Redis port |
| `REDIS_PASSWORD` | No | — | Redis password (optional) |
| `JWT_ACCESS_SECRET` | Yes | — | JWT access token signing secret |
| `JWT_REFRESH_SECRET` | Yes | — | JWT refresh token signing secret |
| `JWT_ACCESS_EXPIRES_IN` | No | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token TTL |
| `AUTH_RATE_LIMIT_WINDOW_MS` | No | `60000` | Rate limit window (ms) |
| `AUTH_RATE_LIMIT_MAX` | No | `10` | Max auth requests per window |
| `EMAIL_FROM` | No | `noreply@taskflow.dev` | Email sender address |

## Testing

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# With coverage report
npm run test:coverage
```

Integration tests require a running PostgreSQL instance (`TEST_DATABASE_URL`). Each test file uses `cleanDatabase()` to truncate tables before each test.

## API Documentation

- Swagger UI: `http://localhost:3000/api-docs`
- OpenAPI spec: `docs/openapi.yaml`
- Postman collection: `docs/TaskFlow.postman_collection.json`

### Postman Quick Start

1. Import `docs/TaskFlow.postman_collection.json`
2. The `baseUrl` variable is pre-set to `http://localhost:3000`
3. Run **Login** — tokens are auto-captured in collection variables
4. All subsequent requests use `{{accessToken}}` automatically

## Authentication

```
POST /auth/register  { name, email, password, organizationId }
POST /auth/login     { email, password }
POST /auth/refresh   { refreshToken }
POST /auth/logout    { refreshToken }
POST /auth/logout-all   (requires Bearer token)
```

All auth endpoints are rate-limited to **10 requests/minute/IP**.

## Multi-Tenancy

Every service-layer query is scoped to `req.user.orgId` (from the JWT). Client-provided org IDs are never trusted. Cross-tenant access returns `404` (resource not found in your org) — never leaking resource existence.

## Background Jobs

When a task is assigned, an email notification job is enqueued to BullMQ:

- **3 retry attempts** with exponential backoff (1s → 2s → 4s)
- After exhaustion, jobs are moved to `email-notifications-dlq`
- Job status: `GET /jobs/:id`
- Email sending is **mocked** (logs to console) — replace with Nodemailer/SES in production

## Technical Decisions

See `docs/architecture.md` for detailed decisions covering:
- Auth token strategy
- Multi-tenant isolation pattern
- Task assignment consistency strategy
- Retry/DLQ strategy
- Database cascade decisions
- Soft delete approach
