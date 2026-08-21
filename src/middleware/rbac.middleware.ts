import { Request, Response, NextFunction } from 'express';
import { forbidden, unauthorized } from '../utils/errors';

/**
 * Require that the authenticated user has one of the specified roles.
 * Must be used after requireAuth.
 *
 * Example:
 *   router.delete('/:id', requireAuth, requireRole('org_admin'), controller.delete)
 */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(unauthorized());
    }
    if (!roles.includes(req.user.role)) {
      return next(forbidden('Insufficient permissions for this action'));
    }
    next();
  };
}
