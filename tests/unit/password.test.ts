/**
 * Unit tests — authentication logic (password hashing / comparison).
 */

import { hashPassword, comparePassword } from '../../src/utils/password';

describe('password utils', () => {
  it('hashes a password and produces a bcrypt hash', async () => {
    const hash = await hashPassword('Secret123!');
    expect(hash).toMatch(/^\$2b\$12\$/); // cost factor 12
  });

  it('comparePassword returns true for correct password', async () => {
    const hash = await hashPassword('CorrectHorse');
    const result = await comparePassword('CorrectHorse', hash);
    expect(result).toBe(true);
  });

  it('comparePassword returns false for wrong password', async () => {
    const hash = await hashPassword('CorrectHorse');
    const result = await comparePassword('WrongPony', hash);
    expect(result).toBe(false);
  });

  it('produces different hashes for the same password (salted)', async () => {
    const h1 = await hashPassword('SamePassword');
    const h2 = await hashPassword('SamePassword');
    expect(h1).not.toBe(h2);
  });
});
