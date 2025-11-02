# Contributing

Thanks for taking a look. Orqivanta is a portfolio project, but issues and pull requests are welcome.

## Getting set up

Follow [Running it locally](README.md#running-it-locally). You need Node 22, pnpm 10 and Docker
(or PostgreSQL 16).

## Before opening a pull request

```bash
pnpm typecheck
pnpm test        # integration tests against a real database
pnpm test:e2e    # Playwright + axe
```

## House rules

- **No dead controls.** Every button does something real, or it isn't shown.
- **No fake data or analytics.** Sample data is labelled; reports come from real records.
- **The server is the authority.** Check permissions in `packages/core`, not only in the UI.
  Tenant tables are protected by row-level security; keep it that way.
- **Every string is translated.** Add English to `apps/web/messages/en/*.json` and Russian to
  `apps/web/messages/ru/*.json`. Server error messages go in `apps/web/messages/ru.server.json`.
- **Accessible by default.** Real buttons and links, labelled inputs, visible focus and a keyboard
  path for anything you can drag. The e2e suite runs axe on the main pages.
- **Schema changes are migrations.** Edit `packages/db/src/schema`, then run
  `pnpm --filter @orqivanta/db generate`.

Keep pull requests focused on one change, and describe what a person would see before and after.
