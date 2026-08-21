import { Router } from 'express';
import { jobController } from './job.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();

// GET /jobs/:id — get job status and metadata
router.get('/:id', requireAuth, jobController.getById.bind(jobController));

export default router;
