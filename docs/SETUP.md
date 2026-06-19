# Setup · Соня v10

1. Залий ZIP у GitHub repo `projectseniorservice`.
2. Дочекайся деплою Cloudflare Workers.
3. Відкрий `/route-check` і перевір версію:

```text
sonya-v10-friendly-sonya-gemini-ui
```

4. Відкрий `/admin`.
5. Якщо це перший запуск — натисни `Save First Setup & Enter Admin` або задай свої коди.
6. У Admin → API Keys додай:
   - `OPENAI_API_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_WEBHOOK_SECRET`
   - `PUBLIC_BASE_URL`
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
7. У Admin → Integrations натисни `Set / Repair webhook`.
8. У Admin → Google натисни `Connect Google`.

## Стартові коди

```text
Admin secret: sonya-admin-2026
Owner access code: owner2026
Family access code: family2026
```

## Важливо

R2 не використовується. Фото, голос і документи не зберігаються binary, щоб не витрачати 10 GB/month.
