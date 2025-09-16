import { desc, emailLog, eq, withSystem } from '@orqivanta/db';
import { AppError } from '../errors';
import { config } from '../config';

/**
 * The development mailbox: every outgoing email is copied to email_log, so verification
 * and invitation links work without an email provider. Only available in demo/dev mode,
 * and never exposed in production — it would otherwise reveal other people's mail.
 */
function assertDevMailbox() {
  if (!config.demoMode) throw new AppError('NOT_FOUND', 'That page');
}

export async function listDevEmails(limit = 50) {
  assertDevMailbox();
  return withSystem((tx) =>
    tx
      .select({ id: emailLog.id, to: emailLog.to, subject: emailLog.subject, transport: emailLog.transport, status: emailLog.status, error: emailLog.error, createdAt: emailLog.createdAt })
      .from(emailLog)
      .orderBy(desc(emailLog.createdAt))
      .limit(Math.min(Math.max(limit, 1), 200)),
  );
}

export async function getDevEmail(id: string) {
  assertDevMailbox();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await withSystem((tx) => tx.select().from(emailLog).where(eq(emailLog.id, id)));
  return row ?? null;
}
