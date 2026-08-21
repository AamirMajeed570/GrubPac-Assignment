/**
 * Auth helper for integration tests.
 * Returns a valid Bearer token for a user/org/role without going through HTTP.
 */

import { signAccessToken } from '../../src/utils/jwt';

export function makeAccessToken(
  userId: string,
  orgId: string,
  role: string,
  email: string
): string {
  return signAccessToken({ sub: userId, orgId, role, email });
}

export function bearerHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
