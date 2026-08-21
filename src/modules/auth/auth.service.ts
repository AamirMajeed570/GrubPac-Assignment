import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { prisma } from '../../config/database';
import { hashPassword, comparePassword } from '../../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import {
  AppError,
  ErrorCode,
  conflict,
  notFound,
  unauthorized,
} from '../../utils/errors';
import { RegisterInput, LoginInput, AuthTokens, AuthResponse } from './auth.types';
import { env } from '../../config/env';

// Refresh token TTL in ms  (7 days)
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Hash a raw refresh token for DB storage.
 * We store only the hash — never the raw token — so a DB leak
 * does not expose valid refresh tokens.
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export class AuthService {
  /**
   * Register a new user and attach them to an existing organization.
   *
   * Decision: users must supply a valid organizationId at registration.
   * This is the simplest model that satisfies multi-tenant isolation
   * without needing a separate org-creation flow here.
   */
  async register(input: RegisterInput): Promise<AuthResponse> {
    const { name, email, password, organizationId } = input;

    // Check email uniqueness
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw conflict('Email already registered', ErrorCode.EMAIL_ALREADY_EXISTS);
    }

    // Verify the organization exists
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) {
      throw notFound('Organization', organizationId);
    }

    const passwordHash = await hashPassword(password);

    // Create user + membership in a transaction
    const { user, member } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, passwordHash },
      });

      // First member of an org becomes org_admin; subsequent members become member
      const memberCount = await tx.orgMember.count({ where: { organizationId } });
      const role = memberCount === 0 ? 'org_admin' : 'member';

      const member = await tx.orgMember.create({
        data: { userId: user.id, organizationId, role: role as 'org_admin' | 'member' },
      });

      return { user, member };
    });

    const tokens = await this._issueTokens(user.id, organizationId, member.role);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: member.role,
        organizationId,
        organizationName: org.name,
      },
      tokens,
    };
  }

  /**
   * Login with email + password.
   * Returns tokens scoped to the user's primary organization membership.
   *
   * Decision: if a user belongs to multiple orgs, we use their first
   * membership by created_at. Multi-org switching is out of scope for
   * this assignment.
   */
  async login(input: LoginInput): Promise<AuthResponse> {
    const { email, password } = input;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: { organization: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    if (!user) {
      // Constant-time: still hash even on not-found to prevent timing attacks
      await hashPassword(password);
      throw unauthorized('Invalid email or password');
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      throw unauthorized('Invalid email or password');
    }

    const membership = user.memberships[0];
    if (!membership) {
      throw new AppError(
        'User has no organization membership',
        403,
        ErrorCode.FORBIDDEN
      );
    }

    const tokens = await this._issueTokens(
      user.id,
      membership.organizationId,
      membership.role
    );

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: membership.role,
        organizationId: membership.organizationId,
        organizationName: membership.organization.name,
      },
      tokens,
    };
  }

  /**
   * Rotate refresh token.
   * Old token is revoked; a new token pair is issued.
   *
   * Bonus: refresh token rotation — each use invalidates the previous token.
   */
  async refresh(rawRefreshToken: string): Promise<AuthTokens> {
    let payload;
    try {
      payload = verifyRefreshToken(rawRefreshToken);
    } catch {
      throw unauthorized('Invalid or expired refresh token');
    }

    const tokenHash = hashToken(rawRefreshToken);
    const stored = await prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null },
      include: {
        user: {
          include: {
            memberships: {
              orderBy: { createdAt: 'asc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!stored || stored.userId !== payload.sub) {
      throw unauthorized('Refresh token not found or already revoked');
    }

    if (stored.expiresAt < new Date()) {
      throw unauthorized('Refresh token expired');
    }

    const membership = stored.user.memberships[0];
    if (!membership) {
      throw new AppError('No organization membership', 403, ErrorCode.FORBIDDEN);
    }

    // Revoke old token + issue new pair (rotation) in a transaction
    const tokens = await prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
      return this._issueTokens(stored.userId, membership.organizationId, membership.role, tx);
    });

    return tokens;
  }

  /**
   * Logout: revoke the supplied refresh token.
   */
  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = hashToken(rawRefreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    // Silently succeed even if the token wasn't found (already revoked / invalid)
  }

  /**
   * Logout all devices: revoke every active refresh token for the user.
   * Bonus feature.
   */
  async logoutAll(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async _issueTokens(
    userId: string,
    organizationId: string,
    role: string,
    // Optional: pass a Prisma transaction client
    tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
  ): Promise<AuthTokens> {
    const db = tx ?? prisma;

    // Fetch user email for the access token payload
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    const jti = uuidv4();
    const accessToken = signAccessToken({
      sub: userId,
      orgId: organizationId,
      role,
      email: user?.email ?? '',
    });

    const rawRefreshToken = signRefreshToken({ sub: userId, jti });
    const tokenHash = hashToken(rawRefreshToken);

    await db.refreshToken.create({
      data: {
        id: jti,
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }
}

export const authService = new AuthService();
