import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';

import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware';
import healthRouter from './modules/health/health.routes';
import authRouter from './modules/auth/auth.routes';
import organizationRouter from './modules/organizations/organization.routes';
import projectRouter from './modules/projects/project.routes';
import taskRouter from './modules/tasks/task.routes';
import jobRouter from './modules/jobs/job.routes';
import { setupSwagger } from './modules/docs/swagger';

export function createApp(): Application {
  const app = express();

  // ── Security headers ──────────────────────────────────────────────────
  app.use(helmet({
    // Relax CSP for Swagger UI
    contentSecurityPolicy: false,
  }));

  // ── CORS ──────────────────────────────────────────────────────────────
  app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }));

  // ── Body parsing ──────────────────────────────────────────────────────
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ── Swagger UI (available at /api-docs) ───────────────────────────────
  setupSwagger(app);

  // ── Routes ────────────────────────────────────────────────────────────
  app.use('/health', healthRouter);
  app.use('/auth', authRouter);
  app.use('/organizations', organizationRouter);

  // /projects — includes nested /projects/:projectId/tasks
  app.use('/projects', projectRouter);

  // /tasks — standalone task operations (get/update/delete/assign)
  app.use('/tasks', taskRouter);

  app.use('/jobs', jobRouter);

  // ── 404 + Error handlers (must be last) ───────────────────────────────
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
