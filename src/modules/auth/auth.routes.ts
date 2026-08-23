import { Router } from 'express';
import { authController } from './auth.controller';
import { authRateLimit } from '../../middleware/rateLimit.middleware';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();

router.use(authRateLimit);

router.post('/register', authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));
router.post('/refresh', authController.refresh.bind(authController));
router.post('/logout', authController.logout.bind(authController));
router.post('/logout-all', requireAuth, authController.logoutAll.bind(authController));

export default router;
