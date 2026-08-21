/**
 * Unit tests — AppError factory helpers.
 */

import { AppError, ErrorCode, notFound, unauthorized, forbidden, validationError, conflict } from '../../src/utils/errors';

describe('AppError', () => {
  it('is an instance of Error', () => {
    const err = new AppError('msg', 400, ErrorCode.VALIDATION_ERROR);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it('carries statusCode, code, and details', () => {
    const err = new AppError('bad', 422, ErrorCode.VALIDATION_ERROR, { field: 'email' });
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(err.details).toEqual({ field: 'email' });
  });
});

describe('error factories', () => {
  it('unauthorized returns 401', () => {
    const err = unauthorized();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it('forbidden returns 403', () => {
    const err = forbidden();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('notFound("task") returns 404 with TASK_NOT_FOUND code', () => {
    const err = notFound('task', 'abc-123');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe(ErrorCode.TASK_NOT_FOUND);
    expect(err.message).toContain('abc-123');
  });

  it('notFound("project") returns PROJECT_NOT_FOUND code', () => {
    const err = notFound('project');
    expect(err.code).toBe(ErrorCode.PROJECT_NOT_FOUND);
  });

  it('validationError returns 422', () => {
    const err = validationError('Invalid input', { name: ['required'] });
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(err.details).toEqual({ name: ['required'] });
  });

  it('conflict returns 409', () => {
    const err = conflict('Already assigned', ErrorCode.DUPLICATE_ASSIGNMENT);
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe(ErrorCode.DUPLICATE_ASSIGNMENT);
  });
});
