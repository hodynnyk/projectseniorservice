# projectseniorservice · Соня v8

Приватна сімейна AI OS на Cloudflare Workers: Telegram Bot, Telegram Mini App, Web Admin, KV, D1, GPT, weather tool, metadata-only file cards, Owner-personality і Family reset.

## v8 hotfix

- `route-check` version: `sonya-v8-no-r2-personality-family-reset`.
- R2 повністю вимкнено з deployment config: немає `r2_buckets`, немає binary upload/download.
- Фото/документи не скачуються з Telegram і не кладуться в storage. Соня створює тільки metadata-картку, якщо є явна команда зберегти.
- Voice/audio запити вимкнено, щоб не тягнути файли і не витрачати зайві ресурси.
- Owner-акаунт отримав персональний стиль: тепле звертання, “сер/господин”, привітання після довгої паузи, але без перебору.
- Соня більше не заносить усе в записи автоматично: якщо намір не явний, вона уточнює, що зробити.
- Admin → Users має кнопку `Reset Family account`.

## Швидкий старт

1. Залий ZIP у GitHub repo `projectseniorservice`.
2. Дочекайся Cloudflare deploy.
3. Відкрий `/route-check`.
4. Відкрий `/admin`.
5. Увійди через `sonya-admin-2026` або Owner code `owner2026`.
6. API Keys → встав `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `PUBLIC_BASE_URL`, `OPENAI_API_KEY`.
7. API Keys → `Set / Repair Telegram webhook`.
8. У Telegram: `/start owner2026`.

## Bindings

- KV: `SONYA_KV` → id `1871b5152bde4980be4c656ac27a446e`
- D1: `DB` → database `projectseniorservice`, id `41ef1a3a-903c-494f-aff4-af2ff9d2ceef`
- R2: intentionally disabled in v8

## Основні адреси

- `/admin` — Web Admin
- `/miniapp` — Telegram Mini App / Family OS
- `/route-check` — версія build
- `/health` — health
- `/telegram/webhook/:secret` — Telegram webhook

## File policy

У v8 не використовується R2. Це зроблено навмисно, щоб не ризикувати 10 GB/month. Файли і фото реєструються тільки як легкі картки: title, description, mimeType, size, Telegram file_id у metadata. Binary-дані не зберігаються.

## Voice policy

Голосові запити вимкнені. Бот просить Owner писати текстом. Це стабільніше для Workers free tier і не використовує file download/transcription pipeline.
