# projectseniorservice · Соня Family OS

Private family AI assistant for Cloudflare Workers + Telegram Bot + Telegram Mini App + Web Admin.

## v3 admin hotfix

This build fixes the first-login/admin routing confusion:

- `/admin` now always serves the Admin / First Setup UI.
- `/setup`, `/__admin`, `/sonya-admin`, `/admin-panel` are backup admin routes.
- `/miniapp` is the family Mini App panel.
- `/route-check` confirms deployed route version.
- First Setup auto-fills simple starter codes so a non-coder can activate the system quickly.

Default First Setup suggestions shown in the form:

- Admin secret: `sonya-admin-2026`
- Owner access code: `owner2026`
- Family access code: `family2026`

You can change them before pressing Save.

## Deploy flow for the user

1. Upload this repository to GitHub repo `projectseniorservice`.
2. Cloudflare deploys Worker `projectseniorservice`.
3. Open:

```text
https://projectseniorservice.bot-worker-tenj.workers.dev/route-check
```

It should show `sonya-v3-admin-hotfix`.

4. Open:

```text
https://projectseniorservice.bot-worker-tenj.workers.dev/admin
```

or backup:

```text
https://projectseniorservice.bot-worker-tenj.workers.dev/setup
```

5. Complete First Setup.
6. Then Mini App login is:

```text
https://projectseniorservice.bot-worker-tenj.workers.dev/miniapp
```

## Bindings already configured

- KV binding: `SONYA_KV`
- KV id: `1871b5152bde4980be4c656ac27a446e`
- D1 binding: `DB`
- D1 name: `projectseniorservice`
- D1 id: `41ef1a3a-903c-494f-aff4-af2ff9d2ceef`

## Main routes

- `/admin` — Web Admin / First Setup
- `/setup` — backup Admin / First Setup
- `/miniapp` — Telegram Mini App panel
- `/health` — health check
- `/api/setup/status` — setup state
- `/route-check` — deployed route version check

## Notes

The product is KV-first for immediate deploy stability. D1 is bound and ready for future expansion.
