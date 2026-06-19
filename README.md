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


## v23 clean Mini App / normal Admin login
- Mini App redesigned as a clean read-only dashboard: no ask box, no creation forms, no noisy extra buttons.
- Mini App shows only: Today, open tasks, body/food journal, and system status.
- Admin UI opens normally on `/admin`, but the public screen only accepts admin secret; owner-code login was removed from the admin screen.
- Sonya visual assets are used contextually: welcome, tasks/night, body/fitness, system/work.
- R2 remains disabled; images are embedded as compressed Worker assets.


## v23 Admin hotfix
- Fixed the over-aggressive v18 admin gate.
- `/admin` opens the admin login again.
- Removed owner-code login button from the admin screen.
- Mini App remains clean/read-only from v18.


## v23 Mini App JSON fix
- Fixed Mini App login error display: no more raw `Bad JSON` text.
- Mini App now reads API responses as text first and safely parses JSON.
- Network/404/non-JSON cases are converted into human messages.
- `/admin` remains normally available from v19.
- Clean Mini App read-only layout remains.


## v23 smart Telegram / voice / maps / dialog memory
- Telegram bot no longer treats every `знайди ...` as a memory search.
- Google Maps intent added for food/places/routes: returns Maps search links instead of active tasks.
- Rolling conversation context added per user/source, so Sonya remembers recent dialog turns.
- Voice messages are supported without R2: Telegram file -> temporary OpenAI transcription -> text -> normal Sonya brain.
- Audio files are not stored.
- Mini App remains clean from v20; admin remains open normally from v19.


## v23 OpenAI diagnostics / fallback
- OpenAI call now tries Responses API first and Chat Completions fallback second.
- If model is unavailable, Sonya returns a human explanation instead of looking silent.
- Added `/api/admin/openai/diagnostics` to test whether the API key is visible and which models are available.
- Admin Integrations now has OpenAI Diagnostics button.
- Default transcription model is `whisper-1` for wider API compatibility.


## v23 OpenAI GPT 5.4 / Image separation
- Default chat text model changed to `gpt-5.4`.
- `OPENAI_MODEL` is now treated as text-only model.
- `OPENAI_IMAGE_MODEL` is a separate key and is shown in Admin API Keys.
- If GPT Image is accidentally placed into `OPENAI_MODEL`, Sonya will not use it for chat and will fall back to text model.
- OpenAI diagnostics now reports raw text model, effective text model, image model, and whether chat/image config is separated.
- First Setup now includes `OPENAI_MODEL`, `OPENAI_IMAGE_MODEL`, and `OPENAI_TRANSCRIBE_MODEL`.
