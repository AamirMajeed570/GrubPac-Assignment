import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { registerSchema, loginSchema, refreshSchema, logoutSchema } from './auth.schema';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { body } = registerSchema.parse({ body: req.body });
      const result = await authService.register(body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { body } = loginSchema.parse({ body: req.body });
      const result = await authService.login(body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { body } = refreshSchema.parse({ body: req.body });
      const tokens = await authService.refresh(body.refreshToken);
      res.status(200).json(tokens);
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { body } = logoutSchema.parse({ body: req.body });
      await authService.logout(body.refreshToken);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED', details: {} });
        return;
      }
      await authService.logoutAll(req.user.userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
