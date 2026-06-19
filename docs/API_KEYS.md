# API Keys · Соня v13

Add these in `/admin → API Keys`.

| Key | Required | Purpose |
|---|---:|---|
| TELEGRAM_BOT_TOKEN | yes | Telegram bot token from BotFather |
| TELEGRAM_WEBHOOK_SECRET | yes | Private webhook URL suffix |
| PUBLIC_BASE_URL | yes | Worker URL |
| OPENAI_API_KEY | optional but recommended | Primary GPT brain |
| OPENAI_MODEL | optional | Example: `gpt-4.1-mini` |
| GEMINI_API_KEY | optional | Secondary/side AI provider |
| GEMINI_MODEL | optional | Example: `gemini-2.5-flash` |
| GEMINI_ENABLED | optional | `true` or `false` |
| GOOGLE_CLIENT_ID | optional | Google OAuth client |
| GOOGLE_CLIENT_SECRET | optional | Google OAuth secret |
| DEFAULT_WEATHER_LOCATION | optional | Default weather city |

## AI Router settings

These are normally edited in `/admin → AI Router`, not manually:

| Setting | Meaning |
|---|---|
| TELEGRAM_AI_PROVIDER | `openai`, `gemini`, or `auto` |
| AI_FALLBACK_PROVIDER | backup provider if active fails |
| SONYA_BASE_PROMPT | base prompt used by all AI models |



## v13 Google visual fix
- Added real anime Соня visual from the provided reference as a Worker-served asset.
- Added Google OAuth Client ID preflight to prevent Google invalid_client screen.
- Added manual API key name input for GEMINI_API_KEY / custom keys.
- Google Connect now explains exactly what is wrong before opening OAuth.


## OpenAI model keys

Use separate keys:

```text
OPENAI_API_KEY = sk-...
OPENAI_MODEL = gpt-5.4
OPENAI_IMAGE_MODEL = gpt-image-1
OPENAI_TRANSCRIBE_MODEL = whisper-1
```

Do not put image model into `OPENAI_MODEL`, because Telegram chat replies need a text model.
