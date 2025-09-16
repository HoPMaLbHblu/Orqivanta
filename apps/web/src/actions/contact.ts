'use server';

import { submitContactMessage } from '@orqivanta/core';
import { run } from '@/lib/action';
import { requestMeta } from '@/lib/session';

/** Public contact form. No session needed; validation, honeypot and rate limits live in core. */
export async function submitContactAction(input: unknown) {
  return run(async () => {
    const meta = await requestMeta();
    return submitContactMessage(input, meta);
  });
}
