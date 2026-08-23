import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { prisma } from '../../config/database';
import { hashPassword, comparePassword } from '../../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { AppError, ErrorCode, conflict, notFound, unauthorized } from '../../utils/errors';
import { RegisterInput, LoginInput, AuthTokens, AuthResponse } from './auth.types';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export class AuthService {
  async register(input: RegisterInput): Promise<AuthResponse> {
    const { name, email, password, organizationId } = input;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw conflict('Email already registered', ErrorCode.EMAIL_ALREADY_EXISTS);

    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw notFound('Organization', organizationId);

    const passwordHash = await hashPassword(password);

    const { user, member } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name, email, passwordHash } });
      const memberCount = await tx.orgMember.count({ where: { organizationId } });
      const role = memberCount === 0 ? 'org_admin' : 'member';
      const member = await tx.orgMember.create({
        data: { userId: user.id, organizationId, role: role as 'org_admin' | 'member' },
      });
      return { user, member };
    });

    const tokens = await this._issueTokens(user.id, organizationId, member.role);

    return {
      user: { id: user.id, name: user.name, email: user.email, role: member.role, organizationId, organizationName: org.name },
      tokens,
    };
  }

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
      await hashPassword(password);
      throw unauthorized('Invalid email or password');
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) throw unauthorized('Invalid email or password');

    const membership = user.memberships[0];
    if (!membership) throw new AppError('User has no organization membership', 403, ErrorCode.FORBIDDEN);

    const tokens = await this._issueTokens(user.id, membership.organizationId, membership.role);

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
          include: { memberships: { orderBy: { createdAt: 'asc' }, take: 1 } },
        },
      },
    });

    if (!stored || stored.userId !== payload.sub) throw unauthorized('Refresh token not found or already revoked');
    if (stored.expiresAt < new Date()) throw unauthorized('Refresh token expired');

    const membership = stored.user.memberships[0];
    if (!membership) throw new AppError('No organization membership', 403, ErrorCode.FORBIDDEN);

    const tokens = await prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
      return this._issueTokens(stored.userId, membership.organizationId, membership.role, tx);
    });

    return tokens;
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = hashToken(rawRefreshToken);
    await prisma.refreshToken.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async logoutAll(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private async _issueTokens(
    userId: string,
    organizationId: string,
    role: string,
    tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
  ): Promise<AuthTokens> {
    const db = tx ?? prisma;

    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });

    const jti = uuidv4();
    const accessToken = signAccessToken({ sub: userId, orgId: organizationId, role, email: user?.email ?? '' });
    const rawRefreshToken = signRefreshToken({ sub: userId, jti });
    const tokenHash = hashToken(rawRefreshToken);

    await db.refreshToken.create({
      data: { id: jti, userId, tokenHash, expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS) },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }
}

export const authService = new AuthService();
