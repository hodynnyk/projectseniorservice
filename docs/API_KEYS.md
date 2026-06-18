# API keys / credentials

The project is built so the ZIP can be uploaded to GitHub without editing code.
Keys are entered in:

```txt
/admin → First Setup
```

or later:

```txt
/admin → API Keys
```

## Required for deployment

These are GitHub repository secrets, not app secrets:

| What | Where to get | For what | Where to insert | Required |
|---|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → API Tokens | GitHub deploys Worker | GitHub Secrets | Yes |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard account page | Worker deploy target | GitHub Secrets | Yes |

## Required for функцій Соні

| What | Where to get | For what | Where to insert | Required |
|---|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Telegram `@BotFather` | Telegram Bot | Admin → API Keys | Yes for Bot |
| `TELEGRAM_WEBHOOK_SECRET` | Make your own random secret | Protect webhook URL | Admin → API Keys / First Setup | Recommended |
| `OPENAI_API_KEY` | OpenAI platform | GPT brain and voice transcription | Admin → API Keys | Yes for GPT |
| `PUBLIC_BASE_URL` | Your deployed Worker URL | Mini App and webhook URLs | First Setup Public Base URL | Yes for Telegram |
| `GOOGLE_CLIENT_ID` | Google Cloud Console OAuth client | Google OAuth | Admin → API Keys | Optional |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console OAuth client | Google OAuth | Admin → API Keys | Optional |
| `RESEND_API_KEY` | Resend dashboard | Outbound email | Admin → API Keys | Optional |
| `WEB_LIBRARY_INBOX_ENDPOINT` | Legal adapter endpoint if available | web-library inbox reading | Admin → API Keys | Optional |

## Do not confuse

Cloudflare deploy secrets go to GitHub Secrets.
runtime Соні keys go to Соня Admin Panel.
