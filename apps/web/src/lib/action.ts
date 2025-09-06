import 'server-only';
import { AppError, httpStatus } from '@orqivanta/core';

export type ActionError = {
  code: AppError['code'] | 'INTERNAL';
  message: string;
  fieldErrors?: Record<string, string>;
  current?: unknown;
  retryAfterSeconds?: number;
};
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

/**
 * Runs a server action body and turns failures into a serializable result. Known
 * AppErrors keep their code and message; anything else is logged and reported as a
 * generic failure, so internal details never reach the browser.
 */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof AppError) {
      return { ok: false, error: { code: err.code, message: err.message, ...err.details } };
    }
    // Next.js uses thrown errors for redirect() and notFound(); let those through.
    if (err && typeof err === 'object' && 'digest' in err && typeof (err as { digest: unknown }).digest === 'string' && /^NEXT_(REDIRECT|HTTP_ERROR_FALLBACK)/.test((err as { digest: string }).digest)) {
      throw err;
    }
    console.error('[action] unexpected error', err);
    return { ok: false, error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' } };
  }
}

export { httpStatus };
