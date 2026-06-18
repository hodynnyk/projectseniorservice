# Testing checklist

## Automatic checks included

GitHub Actions runs:

```bash
npm run check
```

This verifies:

- required files exist;
- all JS/MJS files pass syntax check;
- `src/index.js` imports successfully.

Manual/local developer smoke test:

```bash
npm run smoke
```

Smoke test verifies with in-memory KV:

- `/api/health`;
- `/api/setup/status`;
- `/api/setup`;
- owner session;
- item creation.

## After deploy checklist

1. Open `/api/health` — should return `ok: true`.
2. Open `/admin` — should show First Setup.
3. Complete First Setup.
4. Admin Overview should show KV OK and D1 OK.
5. Add `OPENAI_API_KEY`.
6. Add `TELEGRAM_BOT_TOKEN`.
7. Add/confirm `PUBLIC_BASE_URL`.
8. Click `Set Telegram webhook`.
9. Send `/start OWNER_CODE` to bot.
10. Send `Нагадай завтра купити ліки`.
11. Open `/miniapp` and check Today / Tasks.
12. Open Admin → History and confirm activity log.

## UI checks

- phone portrait;
- phone landscape;
- Telegram mobile webview;
- desktop browser;
- narrow viewport;
- wide viewport;
- empty states;
- login/session persistence;
- no horizontal broken layout.
