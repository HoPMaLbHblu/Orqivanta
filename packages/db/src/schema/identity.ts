import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, id, orgId, ts, updatedAt } from './_shared';

export const users = pgTable(
  'users',
  {
    id: id(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    passwordHash: text('password_hash'),
    emailVerifiedAt: ts('email_verified_at'),
    avatarColor: text('avatar_color').notNull().default('verdigris'),
    avatarFileKey: text('avatar_file_key'),
    timeZone: text('time_zone').notNull().default('UTC'),
    locale: text('locale').notNull().default('en'),
    dateFormat: text('date_format').notNull().default('d MMM yyyy'),
    theme: text('theme').notNull().default('system'),
    /** Users created by the demo seed. The demo switcher only signs into these. */
    isDemo: boolean('is_demo').notNull().default(false),
    isPlatformAdmin: boolean('is_platform_admin').notNull().default(false),
    lastActiveOrgId: uuid('last_active_org_id'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('users_email_key').on(sql`lower(${t.email})`)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** SHA-256 of the opaque token stored in the cookie. The raw token is never persisted. */
    tokenHash: text('token_hash').notNull(),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    createdAt: createdAt(),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
  },
  (t) => [uniqueIndex('sessions_token_hash_key').on(t.tokenHash), index('sessions_user_idx').on(t.userId)],
);

export const emailTokenPurpose = pgEnum('email_token_purpose', ['verify_email', 'reset_password']);

export const emailTokens = pgTable(
  'email_tokens',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: emailTokenPurpose('purpose').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: ts('expires_at').notNull(),
    usedAt: ts('used_at'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('email_tokens_hash_key').on(t.tokenHash)],
);

export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  windowStartedAt: ts('window_started_at').notNull().defaultNow(),
});

export const contactMessages = pgTable('contact_messages', {
  id: id(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  company: text('company'),
  topic: text('topic').notNull(),
  message: text('message').notNull(),
  createdAt: createdAt(),
  handledAt: ts('handled_at'),
});

export const organizations = pgTable(
  'organizations',
  {
    id: id(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    logoFileKey: text('logo_file_key'),
    purpose: text('purpose'),
    /** Onboarding steps completed, e.g. ["template","invite","project"]. */
    onboarding: jsonb('onboarding').$type<string[]>().notNull().default([]),
    storageQuotaMb: integer('storage_quota_mb').notNull().default(1024),
    isDemo: boolean('is_demo').notNull().default(false),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [uniqueIndex('organizations_slug_key').on(t.slug)],
);

export const orgRole = pgEnum('org_role', ['owner', 'admin', 'member', 'client']);
export const membershipStatus = pgEnum('membership_status', ['active', 'suspended']);

export const clientAccounts = pgTable(
  'client_accounts',
  {
    id: id(),
    orgId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    website: text('website'),
    /** Internal notes. Never returned to client contacts. */
    internalNotes: text('internal_notes'),
    accentColor: text('accent_color'),
    archivedAt: ts('archived_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('client_accounts_org_id_key').on(t.orgId, t.id),
    index('client_accounts_org_idx').on(t.orgId),
  ],
);

export const memberships = pgTable(
  'memberships',
  {
    id: id(),
    orgId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: orgRole('role').notNull(),
    status: membershipStatus('status').notNull().default('active'),
    /** Set only for role = client: the client account whose resources this contact may see. */
    clientAccountId: uuid('client_account_id').references(() => clientAccounts.id, {
      onDelete: 'cascade',
    }),
    title: text('title'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('memberships_org_user_key').on(t.orgId, t.userId),
    index('memberships_user_idx').on(t.userId),
  ],
);

export const teams = pgTable(
  'teams',
  {
    id: id(),
    orgId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    color: text('color').notNull().default('verdigris'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('teams_org_name_key').on(t.orgId, t.name)],
);

export const teamMembers = pgTable(
  'team_members',
  {
    orgId: orgId(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('team_members_key').on(t.teamId, t.userId)],
);

export const invitations = pgTable(
  'invitations',
  {
    id: id(),
    orgId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: orgRole('role').notNull(),
    clientAccountId: uuid('client_account_id').references(() => clientAccounts.id, {
      onDelete: 'cascade',
    }),
    /** Optional project to add the invitee to on acceptance. */
    projectId: uuid('project_id'),
    tokenHash: text('token_hash').notNull(),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    message: text('message'),
    expiresAt: ts('expires_at').notNull(),
    acceptedAt: ts('accepted_at'),
    acceptedBy: uuid('accepted_by').references(() => users.id, { onDelete: 'set null' }),
    revokedAt: ts('revoked_at'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('invitations_token_key').on(t.tokenHash),
    index('invitations_org_email_idx').on(t.orgId, sql`lower(${t.email})`),
  ],
);
