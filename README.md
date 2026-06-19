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
