# API Keys · Соня v12

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

