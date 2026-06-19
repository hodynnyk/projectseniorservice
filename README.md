# projectseniorservice · Соня v12

Private Family OS for Cloudflare Workers: Telegram Bot, Mini App, Admin Panel, Google Gmail/Calendar, weather, Gemini side provider, fitness/nutrition/food book, no R2/voice, and AI Router for model switching.

## Version

`sonya-v12-ai-router-model-prompt`

## New in v12

- Admin → **AI Router**.
- Telegram bot model selector: OpenAI / Gemini / Auto.
- Fallback provider if active model fails.
- Shared base prompt for all AI providers.
- The base prompt explains how Соня should speak to Owner and Family.
- OpenAI and Gemini become interchangeable for normal Telegram answers.
- Direct Gemini commands still work: `Gemini: ...`, `спитай Gemini ...`.

## Current storage policy

- R2 disabled.
- Voice/audio disabled.
- Photos/documents are not downloaded automatically.
- Соня does not save everything blindly; explicit intent is required.

## Deploy

Upload the repository content to GitHub repo `projectseniorservice`. Cloudflare deploy command remains:

```bash
npx wrangler deploy
```

After deploy check:

```text
https://projectseniorservice.bot-worker-tenj.workers.dev/route-check
```

Expected version:

```text
sonya-v12-ai-router-model-prompt
```


## v18 change
Telegram Bot no longer attaches the inline Mini App button to every answer. Sonya now replies with clean contextual text only; Mini App is expected to be opened separately through Telegram Mini Apps / bot menu.


## Telegram UI policy v18
Telegram Bot replies without automatic Mini App button. The panel is expected to be opened separately through Telegram Mini Apps / bot menu.


## v18 Google JSON import
- Admin → Google now accepts full Google client_secret JSON paste/import.
- It stores GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET automatically.
- It checks whether `/api/google/callback` is present in Authorized redirect URIs.


## v22 clean Mini App / normal Admin login
- Mini App redesigned as a clean read-only dashboard: no ask box, no creation forms, no noisy extra buttons.
- Mini App shows only: Today, open tasks, body/food journal, and system status.
- Admin UI opens normally on `/admin`, but the public screen only accepts admin secret; owner-code login was removed from the admin screen.
- Sonya visual assets are used contextually: welcome, tasks/night, body/fitness, system/work.
- R2 remains disabled; images are embedded as compressed Worker assets.


## v22 Admin hotfix
- Fixed the over-aggressive v18 admin gate.
- `/admin` opens the admin login again.
- Removed owner-code login button from the admin screen.
- Mini App remains clean/read-only from v18.


## v22 Mini App JSON fix
- Fixed Mini App login error display: no more raw `Bad JSON` text.
- Mini App now reads API responses as text first and safely parses JSON.
- Network/404/non-JSON cases are converted into human messages.
- `/admin` remains normally available from v19.
- Clean Mini App read-only layout remains.


## v22 smart Telegram / voice / maps / dialog memory
- Telegram bot no longer treats every `знайди ...` as a memory search.
- Google Maps intent added for food/places/routes: returns Maps search links instead of active tasks.
- Rolling conversation context added per user/source, so Sonya remembers recent dialog turns.
- Voice messages are supported without R2: Telegram file -> temporary OpenAI transcription -> text -> normal Sonya brain.
- Audio files are not stored.
- Mini App remains clean from v20; admin remains open normally from v19.

## v22 OpenAI Base URL / SecureAPI proxy
- Added `OPENAI_BASE_URL` support for OpenAI-compatible endpoints.
- For the current secureapi provider use:
  - `OPENAI_BASE_URL=https://3xanny-secureapi.hf.space/v1`
  - `OPENAI_MODEL=gpt-5.4-mini` or `gpt-5.5`
  - `OPENAI_API_KEY=sk-sec-...`
- If `OPENAI_BASE_URL` is empty and the key starts with `sk-sec-`, Sonya automatically uses `https://3xanny-secureapi.hf.space/v1`.
- OpenAI calls try `/responses` first and can fall back to `/chat/completions` for OpenAI-compatible providers.
- Provider errors are sanitized so full API keys are not printed in Telegram replies.
- Voice still uses temporary transcription without R2; it will call `${OPENAI_BASE_URL}/audio/transcriptions` when a proxy base URL is configured.

## v23 Life Core / Local-first / Mood Engine

Версія: `sonya-v23-life-core-local-mood`.

Що додано:

- Mini App Tasks: статуси задач `Нова/Open`, `Відкласти/Postponed`, `Завершено/Done` з кнопками в UI.
- Telegram natural commands для задач: “заверши задачу …”, “відклади …”, “поверни …”, “покажи активні задачі”.
- Mini App Body: структурований wellness центр: курс/план тренувань, раціон, самопочуття, журнал тренувань/їжі, місячна статистика.
- Local-first storage у Mini App: особисті Body/food/wellness записи зберігаються на девайсі, з export/import/clear.
- Persona/Profile API: `/api/persona`, `/api/mood/state`.
- Режими Соні: `clear` / `alive` / `spark` (spark тільки Owner).
- Live mood state: емоційний стан, інтелектуальний стан, “слова на душі”.
- Role-based mood filter: Family бачить тільки family-safe assets; Owner має приватний pack.
- Доданий mood/action asset manifest і 31 оптимізований WebP asset у `public/assets/moods`.
- Static assets binding `ASSETS` у Wrangler для lazy/static delivery без R2.
- Telegram photo vision: фото аналізуються тимчасово через OpenAI-compatible vision без R2 і без збереження файлу, якщо користувач не просить зберегти.
- Search/action helper: підготовка Google/Maps/YouTube посилань для номерів, адрес, місць, рішень, відео/кіно/книг.
- Owner-only secrets: тип запису `secret`, недоступний Family.
- Архітектурні guardrails: manifest-driven assets, role-based packs, local-first privacy, schema-safe status values.

Перевірено:

- `npm run check`
- `npm run smoke`
- `wrangler deploy --dry-run --outdir ...` прочитав static assets і показав binding `env.ASSETS`.
