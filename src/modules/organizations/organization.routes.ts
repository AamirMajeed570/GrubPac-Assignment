import { Router } from 'express';
import { organizationController } from './organization.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';

const router = Router();

// All org routes require authentication
router.use(requireAuth);

// GET /organizations/me — current user's org details
router.get('/me', organizationController.getMyOrg.bind(organizationController));

// GET /organizations/me/members — list all org members
router.get('/me/members', organizationController.listMembers.bind(organizationController));

// PATCH /organizations/me/members/:userId/role — change a member's role (admin only)
router.patch(
  '/me/members/:userId/role',
  requireRole('org_admin'),
  organizationController.updateMemberRole.bind(organizationController)
);

// DELETE /organizations/me/members/:userId — remove a member (admin only)
router.delete(
  '/me/members/:userId',
  requireRole('org_admin'),
  organizationController.removeMember.bind(organizationController)
);

export default router;
