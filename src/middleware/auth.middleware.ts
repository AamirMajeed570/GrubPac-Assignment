import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessTokenPayload } from '../utils/jwt';
import { unauthorized } from '../utils/errors';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export interface AuthUser {
  userId: string;
  orgId: string;
  role: string;
  email: string;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next(unauthorized('Missing or malformed Authorization header'));
    }

    const token = authHeader.slice(7);
    const payload: AccessTokenPayload = verifyAccessToken(token);

    req.user = {
      userId: payload.sub,
      orgId: payload.orgId,
      role: payload.role,
      email: payload.email,
    };

    next();
  } catch (err) {
    next(err);
  }
}
