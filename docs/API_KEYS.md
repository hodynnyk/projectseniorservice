# API Keys · projectseniorservice v10

| Що потрібно | Обовʼязково | Де взяти | Для чого | Куди вставити |
|---|---:|---|---|---|
| TELEGRAM_BOT_TOKEN | Так для бота | BotFather | Telegram Bot | Admin → API Keys |
| TELEGRAM_WEBHOOK_SECRET | Так для бота | придумати самому | секрет webhook URL | Admin → API Keys |
| PUBLIC_BASE_URL | Так | Cloudflare Worker URL | Mini App, webhook, OAuth callback | Admin → API Keys або First Setup |
| OPENAI_API_KEY | Так для GPT | OpenAI Platform | основний мозок Соні | Admin → API Keys |
| OPENAI_MODEL | Ні | значення моделі | модель OpenAI | Admin → API Keys |
| GEMINI_API_KEY | Ні, але потрібен для Gemini | Google AI Studio | Gemini sidecar AI, не основний мозок | Admin → API Keys |
| GEMINI_MODEL | Ні | назва Gemini моделі | default `gemini-2.5-flash` | Admin → API Keys |
| GEMINI_ENABLED | Ні | `true` або `false` | керування Gemini sidecar | Admin → API Keys |
| GOOGLE_CLIENT_ID | Так для Gmail/Calendar | Google Cloud Console → OAuth Client | Google OAuth | Admin → API Keys |
| GOOGLE_CLIENT_SECRET | Так для Gmail/Calendar | Google Cloud Console → OAuth Client | Google OAuth token exchange | Admin → API Keys |
| GOOGLE_GMAIL_ENABLED | Ні | `true` або `false` | перемикач Gmail | Admin → API Keys |
| GOOGLE_CALENDAR_ENABLED | Ні | `true` або `false` | перемикач Calendar | Admin → API Keys |
| DEFAULT_WEATHER_LOCATION | Ні | текстом | погода за замовчуванням | Admin → API Keys |
| RESEND_API_KEY | Ні | Resend | outbound mail не через Gmail | Admin → API Keys |

## Google OAuth scopes

```text
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.modify
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/calendar.readonly
```

Для особистого приватного використання додай свій Google акаунт як test user у OAuth consent screen, якщо Google попросить.

## Redirect URI

У Google Cloud OAuth Client треба додати саме твій Worker URL:

```text
https://projectseniorservice.bot-worker-tenj.workers.dev/api/google/callback
```

Якщо Worker URL інший — використай той, що показує Admin → Google → Redirect URI.
