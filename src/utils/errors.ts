export enum ErrorCode {
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INVALID_REFRESH_TOKEN = 'INVALID_REFRESH_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  ORGANIZATION_NOT_FOUND = 'ORGANIZATION_NOT_FOUND',
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  JOB_NOT_FOUND = 'JOB_NOT_FOUND',
  MEMBER_NOT_FOUND = 'MEMBER_NOT_FOUND',
  DUPLICATE_ASSIGNMENT = 'DUPLICATE_ASSIGNMENT',
  USER_NOT_IN_ORG = 'USER_NOT_IN_ORG',
  ALREADY_MEMBER = 'ALREADY_MEMBER',
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details: Record<string, unknown>;

  constructor(message: string, statusCode: number, code: ErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function unauthorized(message = 'Unauthorized'): AppError {
  return new AppError(message, 401, ErrorCode.UNAUTHORIZED);
}

export function forbidden(message = 'Forbidden'): AppError {
  return new AppError(message, 403, ErrorCode.FORBIDDEN);
}

export function notFound(resource: string, id?: string): AppError {
  const codeMap: Record<string, ErrorCode> = {
    user: ErrorCode.USER_NOT_FOUND,
    organization: ErrorCode.ORGANIZATION_NOT_FOUND,
    project: ErrorCode.PROJECT_NOT_FOUND,
    task: ErrorCode.TASK_NOT_FOUND,
    job: ErrorCode.JOB_NOT_FOUND,
    member: ErrorCode.MEMBER_NOT_FOUND,
  };
  const code = codeMap[resource.toLowerCase()] ?? ErrorCode.NOT_FOUND;
  const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
  return new AppError(message, 404, code);
}

export function validationError(message: string, details: Record<string, unknown> = {}): AppError {
  return new AppError(message, 422, ErrorCode.VALIDATION_ERROR, details);
}

export function conflict(message: string, code: ErrorCode): AppError {
  return new AppError(message, 409, code);
}
