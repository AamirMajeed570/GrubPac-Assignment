import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { organizationService } from './organization.service';
import { unauthorized } from '../../utils/errors';

const updateRoleSchema = z.object({
  body: z.object({
    role: z.enum(['org_admin', 'member']),
  }),
});

export class OrganizationController {
  async getMyOrg(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) return next(unauthorized());
      const org = await organizationService.getMyOrganization(req.user.orgId);
      res.json(org);
    } catch (err) {
      next(err);
    }
  }

  async listMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) return next(unauthorized());
      const members = await organizationService.listMembers(req.user.orgId);
      res.json(members);
    } catch (err) {
      next(err);
    }
  }

  async removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) return next(unauthorized());
      const { userId } = req.params;
      await organizationService.removeMember(req.user.orgId, userId, req.user.userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async updateMemberRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) return next(unauthorized());
      const { body } = updateRoleSchema.parse({ body: req.body });
      const { userId } = req.params;
      const updated = await organizationService.updateMemberRole(
        req.user.orgId,
        userId,
        body.role
      );
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
}

export const organizationController = new OrganizationController();
