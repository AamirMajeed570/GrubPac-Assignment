import { Router } from 'express';
import { taskController } from './task.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.post('/bulk-status', taskController.bulkUpdateStatus.bind(taskController));

router.get('/:id', taskController.getById.bind(taskController));
router.patch('/:id', taskController.update.bind(taskController));
router.delete('/:id', taskController.delete.bind(taskController));
router.post('/:id/assign', taskController.assign.bind(taskController));
router.delete('/:id/assign/:userId', taskController.unassign.bind(taskController));

export default router;
