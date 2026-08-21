import { Router } from 'express';
import { authController } from './auth.controller';
import { authRateLimit } from '../../middleware/rateLimit.middleware';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();

// All auth endpoints are rate-limited: 10 req/min/IP (assignment requirement)
router.use(authRateLimit);

// POST /auth/register
router.post('/register', authController.register.bind(authController));

// POST /auth/login
router.post('/login', authController.login.bind(authController));

// POST /auth/refresh  — rotates the refresh token (bonus: token rotation)
router.post('/refresh', authController.refresh.bind(authController));

// POST /auth/logout   — revokes the supplied refresh token
router.post('/logout', authController.logout.bind(authController));

// POST /auth/logout-all  — revokes all refresh tokens (bonus: logout all devices)
router.post('/logout-all', requireAuth, authController.logoutAll.bind(authController));

export default router;
