# Status — release 1

## Done

- Public site: home, product, client portal, agencies, pricing (free preview, no checkout),
  changelog, about, contact (saved to the database), privacy, terms, accessibility,
  404/500, sitemap, robots, Open Graph images.
- Auth: sign-up with email verification, sign-in/out, password reset, invitations for new
  and existing accounts, expired-link pages, sessions with revoke, rate limits, no account
  enumeration.
- Onboarding: organization, template, teammates, first project; resumable.
- Workspace: home, my work, inbox, ⌘K palette, search, favorites, keyboard shortcuts,
  theme, English and Russian.
- Projects, tasks, documents, files, requests, approvals, clients and the client portal as
  described in the README.
- Reports with tables, written metric definitions and CSV export.
- Settings: general, members, invitations, teams, request forms, labels, audit log, data
  export, trash. Account: profile, preferences, notifications, security.
- Seeded demo workspace with a role switcher.
- Core integration tests, Playwright end-to-end tests with axe checks, CI workflow.

## Known limitations

- The rich-text editor's toolbar and mention list haven't been fully tested with screen
  readers.
- User-written content (project names, documents) isn't translated; the demo content is
  in English.
- Changelog entries are English only.

## Not in release 1

Billing, AI features, SSO, Slack/GitHub/calendar integrations, time tracking and
budgets, live co-editing, custom roles, public request forms, custom domains.
