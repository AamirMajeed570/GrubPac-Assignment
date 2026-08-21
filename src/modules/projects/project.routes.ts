import { Router } from 'express';
import { projectController } from './project.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { taskController } from '../tasks/task.controller';

const router = Router();

router.use(requireAuth);

// POST   /projects
router.post('/', projectController.create.bind(projectController));

// GET    /projects
router.get('/', projectController.list.bind(projectController));

// GET    /projects/:id
router.get('/:id', projectController.getById.bind(projectController));

// PATCH  /projects/:id
router.patch('/:id', projectController.update.bind(projectController));

// DELETE /projects/:id — org_admin only (assignment requirement)
router.delete('/:id', requireRole('org_admin'), projectController.delete.bind(projectController));

// GET    /projects/:id/dashboard
router.get('/:id/dashboard', projectController.getDashboard.bind(projectController));

// ── Nested task routes ───────────────────────────────────────────────────────
// POST   /projects/:projectId/tasks
router.post('/:projectId/tasks', (req, res, next) => {
  // Keep projectId param as-is; task controller reads req.params['projectId']
  taskController.create(req, res, next);
});

// GET    /projects/:projectId/tasks
router.get('/:projectId/tasks', (req, res, next) => {
  taskController.list(req, res, next);
});

export default router;
