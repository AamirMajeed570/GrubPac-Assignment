import { Router } from 'express';
import { projectController } from './project.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { taskController } from '../tasks/task.controller';

const router = Router();

router.use(requireAuth);

router.post('/', projectController.create.bind(projectController));
router.get('/', projectController.list.bind(projectController));
router.get('/:id', projectController.getById.bind(projectController));
router.patch('/:id', projectController.update.bind(projectController));
router.delete('/:id', requireRole('org_admin'), projectController.delete.bind(projectController));
router.get('/:id/dashboard', projectController.getDashboard.bind(projectController));

router.post('/:projectId/tasks', (req, res, next) => taskController.create(req, res, next));
router.get('/:projectId/tasks', (req, res, next) => taskController.list(req, res, next));

export default router;
