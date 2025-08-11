import { and, desc, eq, gt, ne, sessions, sql, users, withSystem } from '@orqivanta/db';
import { config } from '../config';
import { randomToken, sha256 } from '../lib/crypto';

export const SESSION_COOKIE = 'orq_session';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  emailVerifiedAt: Date | null;
  avatarColor: string;
  timeZone: string;
  locale: string;
  dateFormat: string;
  theme: string;
  isDemo: boolean;
  isPlatformAdmin: boolean;
  lastActiveOrgId: string | null;
}

export interface ValidatedSession {
  sessionId: string;
  user: SessionUser;
}

const DAY = 24 * 60 * 60 * 1000;

export async function createSession(userId: string, meta: { userAgent?: string | null; ip?: string | null } = {}) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + config.sessionDays * DAY);
  await withSystem((tx) =>
    tx.insert(sessions).values({
      userId,
      tokenHash: sha256(token),
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
      ipAddress: meta.ip ?? null,
      expiresAt,
    }),
  );
  return { token, expiresAt };
}

/**
 * Looks up a session by its raw cookie token. Expired or idle sessions are deleted.
 * lastSeenAt is refreshed at most every 10 minutes to avoid a write per request.
 */
export async function validateSession(token: string | undefined | null): Promise<ValidatedSession | null> {
  if (!token || token.length > 100) return null;
  const tokenHash = sha256(token);
  return withSystem(async (tx) => {
    const [row] = await tx
      .select({ session: sessions, user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(eq(sessions.tokenHash, tokenHash))
      .limit(1);
    if (!row) return null;
    const now = Date.now();
    const idleLimit = row.session.lastSeenAt.getTime() + config.sessionIdleDays * DAY;
    if (row.session.expiresAt.getTime() <= now || idleLimit <= now) {
      await tx.delete(sessions).where(eq(sessions.id, row.session.id));
      return null;
    }
    if (now - row.session.lastSeenAt.getTime() > 10 * 60 * 1000) {
      await tx.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, row.session.id));
    }
    const u = row.user;
    return {
      sessionId: row.session.id,
      user: {
        id: u.id,
        email: u.email,
        name: u.name,
        emailVerifiedAt: u.emailVerifiedAt,
        avatarColor: u.avatarColor,
        timeZone: u.timeZone,
        locale: u.locale,
        dateFormat: u.dateFormat,
        theme: u.theme,
        isDemo: u.isDemo,
        isPlatformAdmin: u.isPlatformAdmin,
        lastActiveOrgId: u.lastActiveOrgId,
      },
    };
  });
}

export async function revokeSessionByToken(token: string) {
  await withSystem((tx) => tx.delete(sessions).where(eq(sessions.tokenHash, sha256(token))));
}

export async function listSessions(userId: string, currentSessionId: string) {
  const rows = await withSystem((tx) =>
    tx
      .select({
        id: sessions.id,
        userAgent: sessions.userAgent,
        ipAddress: sessions.ipAddress,
        createdAt: sessions.createdAt,
        lastSeenAt: sessions.lastSeenAt,
      })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, sql`now()`)))
      .orderBy(desc(sessions.lastSeenAt)),
  );
  return rows.map((r) => ({ ...r, current: r.id === currentSessionId }));
}

/** Revokes one of the user's own sessions. A user can never revoke someone else's session. */
export async function revokeSession(userId: string, sessionId: string) {
  await withSystem((tx) => tx.delete(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId))));
}

export async function revokeOtherSessions(userId: string, keepSessionId: string | null) {
  await withSystem((tx) =>
    tx
      .delete(sessions)
      .where(keepSessionId ? and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)) : eq(sessions.userId, userId)),
  );
}
