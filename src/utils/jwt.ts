import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AccessTokenPayload {
  sub: string;        // userId
  orgId: string;      // organizationId from membership
  role: string;       // org_admin | member
  email: string;
}

export interface RefreshTokenPayload {
  sub: string;        // userId
  jti: string;        // token ID — used for revocation
}

/**
 * Sign a short-lived access token (15 min).
 */
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn,
  } as jwt.SignOptions);
}

/**
 * Sign a long-lived refresh token (7 days).
 */
export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  } as jwt.SignOptions);
}

/**
 * Verify and decode an access token.
 * Throws jwt.JsonWebTokenError / jwt.TokenExpiredError on failure.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;
}

/**
 * Verify and decode a refresh token.
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.jwt.refreshSecret) as RefreshTokenPayload;
}
