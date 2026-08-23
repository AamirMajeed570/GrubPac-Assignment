import { Router } from 'express';
import { organizationController } from './organization.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth);

router.get('/me', organizationController.getMyOrg.bind(organizationController));
router.get('/me/members', organizationController.listMembers.bind(organizationController));
router.patch('/me/members/:userId/role', requireRole('org_admin'), organizationController.updateMemberRole.bind(organizationController));
router.delete('/me/members/:userId', requireRole('org_admin'), organizationController.removeMember.bind(organizationController));

export default router;
