import { Request, Response, NextFunction } from 'express';
import { projectService } from './project.service';
import { createProjectSchema, updateProjectSchema } from './project.schema';
import { unauthorized } from '../../utils/errors';

export class ProjectController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) return next(unauthorized());
      const { body } = createProjectSchema.parse({ body: req.body });
      const project = await projectService.create(req.user.orgId, body);
      res.status(201).json(project);
    } catch (err) {
      next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) return next(unauthorized());
      const result = await projectService.list(req.user.orgId, req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) return next(unauthorized());
      const project = await projectService.getById(req.user.orgId, req.params['id']!);
      res.json(project);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) return next(unauthorized());
      const { body } = updateProjectSchema.parse({ body: req.body });
      const project = await projectService.update(req.user.orgId, req.params['id']!, body);
      res.json(project);
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) return next(unauthorized());
      await projectService.delete(req.user.orgId, req.params['id']!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) return next(unauthorized());
      const dashboard = await projectService.getDashboard(req.user.orgId, req.params['id']!);
      res.json(dashboard);
    } catch (err) {
      next(err);
    }
  }
}

export const projectController = new ProjectController();
