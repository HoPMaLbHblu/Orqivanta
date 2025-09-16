import { z } from 'zod';
import { eq, requests, withTenant } from '@orqivanta/db';
import { notFound } from '../errors';
import { plainToRichText } from '../lib/richtext';
import { parse } from '../lib/validate';
import type { Actor } from '../permissions';
import { createComment } from './comments';
import { triageRequest } from './requests';

const schema = z.object({
  requestId: z.uuid(),
  message: z.string().trim().min(1, 'Write what you need to know first.').max(2000),
});

/**
 * Asks the requester a question and parks the request on "needs info" in one step: posting
 * the comment bumps the request's version, so the two can't be sent from the UI separately
 * without hitting an edit conflict.
 */
export async function askForInformation(actor: Actor, input: unknown) {
  const data = parse(schema, input);
  const before = await withTenant(actor.orgId, async (tx) => {
    const [r] = await tx.select({ clientAccountId: requests.clientAccountId }).from(requests).where(eq(requests.id, data.requestId));
    if (!r) throw notFound('That request');
    return r;
  });
  await createComment(actor, {
    parent: { type: 'request', id: data.requestId },
    body: plainToRichText(data.message),
    visibility: before.clientAccountId ? 'client' : 'internal',
  });
  const current = await withTenant(actor.orgId, async (tx) => {
    const [r] = await tx.select({ version: requests.version }).from(requests).where(eq(requests.id, data.requestId));
    if (!r) throw notFound('That request');
    return r;
  });
  return triageRequest(actor, { requestId: data.requestId, version: current.version, status: 'needs_info' });
}
