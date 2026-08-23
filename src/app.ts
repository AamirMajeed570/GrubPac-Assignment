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

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  setupSwagger(app);

  app.use('/health', healthRouter);
  app.use('/auth', authRouter);
  app.use('/organizations', organizationRouter);
  app.use('/projects', projectRouter);
  app.use('/tasks', taskRouter);
  app.use('/jobs', jobRouter);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
