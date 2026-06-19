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


## v17 change
Telegram Bot no longer attaches the inline Mini App button to every answer. Sonya now replies with clean contextual text only; Mini App is expected to be opened separately through Telegram Mini Apps / bot menu.


## Telegram UI policy v17
Telegram Bot replies without automatic Mini App button. The panel is expected to be opened separately through Telegram Mini Apps / bot menu.


## v17 Google JSON import
- Admin → Google now accepts full Google client_secret JSON paste/import.
- It stores GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET automatically.
- It checks whether `/api/google/callback` is present in Authorized redirect URIs.
