import { Router } from 'express';
import { taskController } from './task.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router({ mergeParams: true });

router.use(requireAuth);

// ── Static routes MUST come before parameterized /:id routes ─────────────────

// ★ Bonus: POST /tasks/bulk-status  (before /:id to avoid param collision)
router.post('/bulk-status', taskController.bulkUpdateStatus.bind(taskController));

// ── Parameterized routes ──────────────────────────────────────────────────────

// GET    /tasks/:id
router.get('/:id', taskController.getById.bind(taskController));

// PATCH  /tasks/:id
router.patch('/:id', taskController.update.bind(taskController));

// DELETE /tasks/:id
router.delete('/:id', taskController.delete.bind(taskController));

// POST   /tasks/:id/assign
router.post('/:id/assign', taskController.assign.bind(taskController));

// DELETE /tasks/:id/assign/:userId
router.delete('/:id/assign/:userId', taskController.unassign.bind(taskController));

export default router;
