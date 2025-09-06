'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useServerMessage } from '@/components/providers/server-messages';

export type ActionError = { code: string; message: string; fieldErrors?: Record<string, string>; current?: unknown; retryAfterSeconds?: number };
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

interface Options {
  /** Toast shown on success. */
  success?: string;
  /** Refresh server components after success (default true). */
  refresh?: boolean;
  /** Don't toast field validation errors; the form shows them inline. */
  inlineFieldErrors?: boolean;
}

/**
 * Calls a server action and handles the common outcomes: translated error toasts,
 * inline field errors, and refreshing the server-rendered page after a change.
 */
export function useAction() {
  const router = useRouter();
  const tr = useServerMessage();
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const call = useCallback(
    async <T,>(fn: () => Promise<ActionResult<T>>, opts: Options = {}): Promise<ActionResult<T>> => {
      setPending(true);
      setFormError(null);
      try {
        const res = await fn();
        if (res.ok) {
          setFieldErrors({});
          if (opts.success) toast.success(opts.success);
          if (opts.refresh !== false) router.refresh();
        } else {
          const fe = Object.fromEntries(Object.entries(res.error.fieldErrors ?? {}).map(([k, v]) => [k, tr(v)]));
          setFieldErrors(fe);
          const message = tr(res.error.message);
          res.error = { ...res.error, message, fieldErrors: fe };
          if (opts.inlineFieldErrors && Object.keys(fe).length) setFormError(null);
          else if (opts.inlineFieldErrors) setFormError(message);
          else toast.error(Object.values(fe)[0] ?? message);
        }
        return res;
      } catch (err) {
        const message = tr('Something went wrong on our side. Please try again.');
        console.error(err);
        if (opts.inlineFieldErrors) setFormError(message);
        else toast.error(message);
        return { ok: false, error: { code: 'INTERNAL', message } };
      } finally {
        setPending(false);
      }
    },
    [router, tr],
  );

  return { call, pending, fieldErrors, formError, setFieldErrors, setFormError };
}
