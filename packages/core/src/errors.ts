/**
 * Errors thrown by services. The web layer maps each code to an HTTP status and a
 * user-facing message; nothing else leaks to the client.
 */
export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PRECONDITION'
  | 'QUOTA_EXCEEDED';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: {
      fieldErrors?: Record<string, string>;
      /** For CONFLICT: the current server-side version, so the UI can offer a resolution. */
      current?: unknown;
      retryAfterSeconds?: number;
    },
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const unauthenticated = (message = 'Please sign in to continue.') =>
  new AppError('UNAUTHENTICATED', message);

export const forbidden = (message = 'You don’t have permission to do that.') =>
  new AppError('FORBIDDEN', message);

/** Use for missing resources AND for resources the actor may not see, so existence never leaks. */
export const notFound = (what = 'That item') =>
  new AppError('NOT_FOUND', `${what} doesn’t exist or you no longer have access to it.`);

export const validation = (fieldErrors: Record<string, string>, message = 'Please check the highlighted fields.') =>
  new AppError('VALIDATION', message, { fieldErrors });

export const conflict = (current: unknown, message = 'Someone else changed this while you were editing.') =>
  new AppError('CONFLICT', message, { current });

export const precondition = (message: string) => new AppError('PRECONDITION', message);

export const isAppError = (err: unknown): err is AppError => err instanceof AppError;

export const httpStatus: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PRECONDITION: 412,
  QUOTA_EXCEEDED: 413,
};
