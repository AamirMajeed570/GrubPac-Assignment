-- ============================================================
-- Initial migration: TaskFlow schema
-- ============================================================

-- Enums
CREATE TYPE "TaskStatus" AS ENUM ('todo', 'in_progress', 'review', 'done');
CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE "OrgRole" AS ENUM ('org_admin', 'member');

-- users
CREATE TABLE "users" (
    "id"            TEXT NOT NULL,
    "email"         TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- organizations
CREATE TABLE "organizations" (
    "id"         TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "slug"       TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- org_members
-- FK decisions:
--   user       → RESTRICT : cannot delete a user still in an org
--   organization → CASCADE : deleting an org removes all memberships
CREATE TABLE "org_members" (
    "id"              TEXT NOT NULL,
    "user_id"         TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role"            "OrgRole" NOT NULL DEFAULT 'member',
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "org_members_user_id_organization_id_key"
    ON "org_members"("user_id", "organization_id");

-- Index: look up all members of an org (primary access pattern)
CREATE INDEX "org_members_organization_id_idx" ON "org_members"("organization_id");

-- Index: look up all orgs a user belongs to
CREATE INDEX "org_members_user_id_idx" ON "org_members"("user_id");

ALTER TABLE "org_members"
    ADD CONSTRAINT "org_members_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "org_members"
    ADD CONSTRAINT "org_members_organization_id_fkey"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- refresh_tokens
-- FK: CASCADE — removing user clears their tokens
CREATE TABLE "refresh_tokens" (
    "id"          TEXT NOT NULL,
    "user_id"     TEXT NOT NULL,
    "token_hash"  TEXT NOT NULL,
    "expires_at"  TIMESTAMP(3) NOT NULL,
    "revoked_at"  TIMESTAMP(3),
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- Index: look up active tokens for a user quickly
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- Index: look up by token hash for validation
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");

ALTER TABLE "refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- projects
-- FK: CASCADE — deleting an org removes its projects
CREATE TABLE "projects" (
    "id"              TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "description"     TEXT,
    "deleted_at"      TIMESTAMP(3),           -- soft delete
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- Index: fetch all projects in an org (primary access pattern)
CREATE INDEX "projects_organization_id_idx" ON "projects"("organization_id");

-- Index: support soft-delete filter (WHERE deleted_at IS NULL)
CREATE INDEX "projects_deleted_at_idx" ON "projects"("deleted_at");

ALTER TABLE "projects"
    ADD CONSTRAINT "projects_organization_id_fkey"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- tasks
-- FK decisions:
--   project → CASCADE : deleting project removes its tasks
--   creator → RESTRICT: cannot delete a user who created tasks
CREATE TABLE "tasks" (
    "id"             TEXT NOT NULL,
    "project_id"     TEXT NOT NULL,
    "creator_id"     TEXT NOT NULL,
    "title"          TEXT NOT NULL,
    "description"    TEXT,
    "status"         "TaskStatus" NOT NULL DEFAULT 'todo',
    "priority"       "TaskPriority" NOT NULL DEFAULT 'medium',
    "due_date"       TIMESTAMP(3),
    "deleted_at"     TIMESTAMP(3),           -- soft delete
    -- ★ Full-text search: generated tsvector column
    "search_vector"  tsvector GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
    ) STORED,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- Index: fetch tasks by project (primary access pattern)
CREATE INDEX "tasks_project_id_idx"  ON "tasks"("project_id");
CREATE INDEX "tasks_status_idx"      ON "tasks"("status");
CREATE INDEX "tasks_priority_idx"    ON "tasks"("priority");
CREATE INDEX "tasks_due_date_idx"    ON "tasks"("due_date");
CREATE INDEX "tasks_deleted_at_idx"  ON "tasks"("deleted_at");

-- ★ GIN index on search_vector for efficient full-text search
CREATE INDEX "tasks_search_vector_idx" ON "tasks" USING GIN ("search_vector");

ALTER TABLE "tasks"
    ADD CONSTRAINT "tasks_project_id_fkey"
        FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tasks"
    ADD CONSTRAINT "tasks_creator_id_fkey"
        FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- task_assignments
-- FK decisions:
--   task → CASCADE : removing task removes assignments
--   user → RESTRICT: cannot delete user with active assignments
CREATE TABLE "task_assignments" (
    "id"          TEXT NOT NULL,
    "task_id"     TEXT NOT NULL,
    "user_id"     TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_assignments_task_id_user_id_key"
    ON "task_assignments"("task_id", "user_id");

-- Index: find all tasks assigned to a user
CREATE INDEX "task_assignments_user_id_idx" ON "task_assignments"("user_id");
-- Index: find all assignees for a task
CREATE INDEX "task_assignments_task_id_idx" ON "task_assignments"("task_id");

ALTER TABLE "task_assignments"
    ADD CONSTRAINT "task_assignments_task_id_fkey"
        FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_assignments"
    ADD CONSTRAINT "task_assignments_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- comments
-- FK decisions:
--   task   → CASCADE : removing task removes its comments
--   author → RESTRICT: cannot delete user who authored comments
CREATE TABLE "comments" (
    "id"         TEXT NOT NULL,
    "task_id"    TEXT NOT NULL,
    "author_id"  TEXT NOT NULL,
    "body"       TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- Index: fetch comments by task
CREATE INDEX "comments_task_id_idx" ON "comments"("task_id");

ALTER TABLE "comments"
    ADD CONSTRAINT "comments_task_id_fkey"
        FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "comments"
    ADD CONSTRAINT "comments_author_id_fkey"
        FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
