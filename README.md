# projectseniorservice — Private Family Соня OS

Production-like Cloudflare Workers project for a private AI assistant that works through:

- Telegram Bot
- Telegram Mini App HTML dashboard
- Web Admin panel
- one shared ядро Соні, storage, memory, tasks, reminders and activity log

This v2 build is prepared for the user's exact GitHub upload flow:

1. Upload this repository to GitHub.
2. Add only two GitHub repository secrets for deployment: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
3. GitHub Actions deploys the Worker.
4. Open `/admin` on the deployed Worker URL.
5. Complete First Setup in the browser UI.
6. Add Telegram/OpenAI/Google keys through Admin Panel.

## Cloudflare resources already wired

```txt
Worker name: projectseniorservice
GitHub repository name: projectseniorservice
Assistant name: Соня
Primary UI language: Ukrainian
Optional UI language: English
Understood input: Ukrainian, Russian, surzhyk, English
KV binding: SONYA_KV
KV namespace id: 1871b5152bde4980be4c656ac27a446e
D1 binding: DB
D1 database name: projectseniorservice
D1 database id: 00000001-00000000-0000508e-c84a51b9d54805a1944eec20354b3faa
```

The app is KV-first so the first deploy can work immediately. D1 is bound and documented for later heavier structured storage, but the running v2 core uses KV to avoid migration/setup blockers.

## Main routes

```txt
/miniapp                         Telegram Mini App / mobile панель Соні
/admin                           Web Admin / First Setup / API keys / modules / logs
/api/health                      Health check
/api/setup/status                First setup status
/api/setup                       First setup POST
/api/*                           Shared API core
/telegram/webhook/:secret        Telegram webhook
```

## What works in v2

- First Setup from Web Admin
- Owner and Family roles
- private/shared visibility
- task/reminder/note/contact/list/expense/car/health/content/QA objects
- Today dashboard
- natural-language command routing
- global search over local пам’ять Соні/items
- Telegram Bot text and voice path
- Telegram Mini App panel
- Web Admin panel
- API key manager
- activity history
- modules on/off
- backup/export
- web-library.net mail account registry and inbox adapter slot
- Google OAuth preparation
- cron reminder sweep every 5 minutes

## Important note about web-library.net

The public web-library.net page states that sending messages to the internet is not available. Therefore this project does not fake outbound mail through web-library.net. It provides account registry + inbox adapter support. For outbound sending, add `RESEND_API_KEY` or another legal outbound provider later.

## Documentation

- `docs/SETUP.md`
- `docs/API_KEYS.md`
- `docs/ARCHITECTURE.md`
- `docs/TESTING.md`
- `docs/CLOUDFLARE_FREE_TIER.md`

## Local commands for developers

The user does not need these for normal GitHub upload flow.

```bash
npm install
npm run check
npm run smoke
npm run deploy
```
