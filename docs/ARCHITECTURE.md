# Architecture

Orqivanta is a modular monolith: one Next.js app, one background worker, and two shared
packages. All business rules live in `packages/core`; the web app and the worker are thin
callers of it.

```
browser ──► apps/web (pages, server actions, API routes)
                │            ▲ SSE
                ▼            │
           packages/core ── lib/events ──► outbox / realtime_events ──► pg_notify
                │                                     │
                ▼                                     ▼
           packages/db ──► PostgreSQL ◄──────── apps/worker (email, notifications,
                                                reminders, cleanup, exports)
```

## Tenancy

- Every tenant table carries `org_id`, and foreign keys inside a tenant are composite
  `(org_id, id)`, so a row can never point at another organization's data.
- The app connects as `orqivanta_app`, which does not own the tables, so PostgreSQL
  row-level security always applies. `withTenant(orgId, fn)` sets `app.org_id` for the
  transaction; policies compare against it. `withSystem` is reserved for the worker,
  migrations and a few cross-org lookups such as sign-in.
- Organization addresses that a visitor can't access return 404, not 403, so URLs reveal
  nothing about which organizations exist.

## Permissions

- One permission model in `packages/core/src/permissions`: organization roles
  (owner, admin, member, client) and project roles (manager, contributor, viewer).
  Owners and admins act as managers everywhere; members reach only projects they belong
  to or team-visible projects of their team.
- Every service function takes an `Actor` and checks it before touching data. Search,
  exports, file downloads and real-time subscriptions use the same checks.
- Client contacts see only items explicitly shared with their own client account
  (`shared_with_client` plus the project's client link and portal switch). Internal comments
  are never returned to them; a client's "internal" comment is coerced to client-visible.

## Editing safety

Tasks, documents and projects carry a `version`. Updates must send the version they were
based on; a mismatch raises `CONFLICT` with the current version, and the UI shows a
conflict dialog. Nothing is overwritten silently.

## Files

Files live in a private folder (`STORAGE_DIR`), never under a public path. Uploads are
type-checked by content (magic bytes), counted against the organization quota and stored
under random keys. Downloads go through `/api/files/[versionId]/download`, which re-checks
permission on every request and answers 404 when access is denied. Images get a generated
preview. A new version of a file under review reopens the approval as a new round.

## Background work and live updates

- Side effects (emails, notifications, realtime events) are written in the same transaction
  as the change, into `outbox` and `realtime_events`. Nothing is sent if the transaction
  rolls back, and nothing is lost if a process dies after commit.
- The worker drains the outbox on `LISTEN orq_outbox` with a polling fallback, retries with
  backoff, and runs scheduled jobs under an advisory lock: due-date reminders, approval
  reminders and cleanup (trash after 30 days, expired sessions, tokens and exports).
- The web app keeps one `LISTEN orq_realtime` connection per process and fans events out
  over Server-Sent Events, filtered per user, organization and visible project. Clients
  reconnect with `Last-Event-ID` and replay what they missed, then refresh the page data.

## Internationalization

UI text lives in `apps/web/messages/<locale>/<area>.json`, one file per area. Domain errors
and notification titles come from core in English; `messages/ru.server.json` translates
them, including templated sentences such as `Review requested: {title}`.

## Demo data

`pnpm demo:reset` builds Northwind Studio through the real services (so it obeys every
rule the app does), then rewrites timestamps onto a six-week story timeline relative to
today. All people, clients and email addresses are fictional and labelled as sample data.

## Simplifications

- The planned `packages/ui` and `packages/emails` were folded into `apps/web` and
  `packages/core` to keep the build simple.
- Live co-editing, SSO/MFA, billing and integrations are out of scope for release 1.
