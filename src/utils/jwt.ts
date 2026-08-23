import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AccessTokenPayload {
  sub: string;
  orgId: string;
  role: string;
  email: string;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwt.accessSecret, { expiresIn: env.jwt.accessExpiresIn } as jwt.SignOptions);
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshExpiresIn } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.jwt.refreshSecret) as RefreshTokenPayload;
}
