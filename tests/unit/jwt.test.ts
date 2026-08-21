/**
 * Unit tests — JWT signing and verification.
 */

import {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../src/utils/jwt';

const ACCESS_PAYLOAD = {
  sub: 'user-123',
  orgId: 'org-456',
  role: 'member',
  email: 'test@example.com',
};

const REFRESH_PAYLOAD = {
  sub: 'user-123',
  jti: 'token-uuid',
};

describe('JWT utils', () => {
  describe('access token', () => {
    it('signs and verifies an access token', () => {
      const token = signAccessToken(ACCESS_PAYLOAD);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('decoded payload contains expected fields', () => {
      const token = signAccessToken(ACCESS_PAYLOAD);
      const decoded = verifyAccessToken(token);
      expect(decoded.sub).toBe(ACCESS_PAYLOAD.sub);
      expect(decoded.orgId).toBe(ACCESS_PAYLOAD.orgId);
      expect(decoded.role).toBe(ACCESS_PAYLOAD.role);
      expect(decoded.email).toBe(ACCESS_PAYLOAD.email);
    });

    it('throws on a tampered token', () => {
      const token = signAccessToken(ACCESS_PAYLOAD);
      const tampered = token.slice(0, -3) + 'xxx';
      expect(() => verifyAccessToken(tampered)).toThrow();
    });
  });

  describe('refresh token', () => {
    it('signs and verifies a refresh token', () => {
      const token = signRefreshToken(REFRESH_PAYLOAD);
      const decoded = verifyRefreshToken(token);
      expect(decoded.sub).toBe(REFRESH_PAYLOAD.sub);
      expect(decoded.jti).toBe(REFRESH_PAYLOAD.jti);
    });

    it('access token cannot be used as refresh token', () => {
      const accessToken = signAccessToken(ACCESS_PAYLOAD);
      // Different secret — should throw
      expect(() => verifyRefreshToken(accessToken)).toThrow();
    });
  });
});
