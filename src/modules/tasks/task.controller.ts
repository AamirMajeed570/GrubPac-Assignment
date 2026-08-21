import { Request, Response, NextFunction } from 'express';
import { taskService } from './task.service';
import {
  createTaskSchema,
  updateTaskSchema,
  taskFiltersSchema,
  assignUserSchema,
  bulkUpdateStatusSchema,
} from './task.schema';
import { unauthorized } from '../../utils/errors';
import { TaskStatus, TaskPriority } from '@prisma/client';

export class TaskController {
  // POST /projects/:projectId/tasks
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) return next(unauthorized());
      const { body } = createTaskSchema.parse({ body: req.body });
      // Support both nested route (:projectId) and re-routed via project.routes (:id alias)
      const projectId = req.params['projectId'] ?? req.params['id'];
      const task = await taskService.create(
        req.user.orgId,
        projectId!,
        req.user.userId,
        body
      );
      res.status(201).json(task);
    } catch (err) {
      next(err);
    }
  }

  // GET /projects/:projectId/tasks
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) return next(unauthorized());
      const { query } = taskFiltersSchema.parse({ query: req.query });
      const projectId = req.params['projectId'] ?? req.params['id'];
      const result = await taskService.list(req.user.orgId, projectId!, query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // GET /tasks/:id
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) return next(unauthorized());
      const task = await taskService.getById(req.user.orgId, req.params['id']!);
      res.json(task);
    } catch (err) {
      next(err);
    }
  }

  // PATCH /tasks/:id
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) return next(unauthorized());
      const { body } = updateTaskSchema.parse({ body: req.body });
      const task = await taskService.update(req.user.orgId, req.params['id']!, {
        ...body,
        status: body.status as TaskStatus | undefined,
        priority: body.priority as TaskPriority | undefined,
      });
      res.json(task);
    } catch (err) {
      next(err);
    }
  }

  // DELETE /tasks/:id
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) return next(unauthorized());
      await taskService.delete(req.user.orgId, req.params['id']!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  // POST /tasks/:id/assign
  async assign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) return next(unauthorized());
      const { body } = assignUserSchema.parse({ body: req.body });
      const result = await taskService.assignUser(
        req.user.orgId,
        req.params['id']!,
        body.userId,
        req.user.userId
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  // DELETE /tasks/:id/assign/:userId
  async unassign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) return next(unauthorized());
      await taskService.unassignUser(
        req.user.orgId,
        req.params['id']!,
        req.params['userId']!
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  // POST /tasks/bulk-status
  async bulkUpdateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) return next(unauthorized());
      const { body } = bulkUpdateStatusSchema.parse({ body: req.body });
      const result = await taskService.bulkUpdateStatus(
        req.user.orgId,
        body.taskIds,
        body.status as TaskStatus
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const taskController = new TaskController();
