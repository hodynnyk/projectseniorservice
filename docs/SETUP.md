# SETUP · projectseniorservice v8

1. Залий ZIP у GitHub repository `projectseniorservice`.
2. Cloudflare автоматично виконає `bun install` / `npx wrangler deploy`.
3. Перевір `/route-check`: має бути `sonya-v8-no-r2-personality-family-reset`.
4. Відкрий `/admin`.
5. Перший вхід: `sonya-admin-2026` або `owner2026`.
6. API Keys → додай:
   - `PUBLIC_BASE_URL` = твій workers.dev URL
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_WEBHOOK_SECRET`
   - `OPENAI_API_KEY`
7. Натисни `Set / Repair Telegram webhook`.
8. Напиши боту `/start owner2026`.
9. Перевір: `погода Обухів`, `що сьогодні`, `знайди ...`.
10. Фото/документи: надсилай тільки з явною командою, наприклад `збережи як документ`. У v8 створюється тільки картка, без R2.

## Family reset

Admin → Users → Reset Family account.

- Safe reset: скидає Telegram, сесії, приватні items/files/mail Family.
- Hard reset: додатково чистить shared objects, створені Family.

## R2

R2 у v8 вимкнено повністю. У `wrangler.jsonc` немає `r2_buckets`. Це зроблено за Owner policy: не витрачати 10 GB/month і не ризикувати перевищенням.
