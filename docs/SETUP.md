# Setup · Соня v18

1. Upload the ZIP content to GitHub repo `projectseniorservice`.
2. Wait for Cloudflare deploy.
3. Open `/route-check` and confirm `sonya-v22-openai-base-url-secureapi`.
4. Open `/admin`.
5. Login with admin secret.
6. Go to **API Keys** and add keys.
7. Go to **AI Router** and choose the model for Telegram Bot.

## AI Router setup

Open:

```text
/admin → AI Router
```

Choose:

- **Active model for Telegram Bot**: OpenAI, Gemini, or Auto.
- **Fallback if active fails**: the backup provider.
- **Base prompt**: shared behavior prompt for all models.

Recommended:

```text
Active: OpenAI / GPT primary
Fallback: Gemini
```

If OpenAI has problems, switch:

```text
Active: Gemini
Fallback: OpenAI / GPT
```



## v18 Google account picker + welcome avatar
- Added real anime Соня visual from the provided reference as a Worker-served asset.
- Added Google OAuth Client ID preflight to prevent Google invalid_client screen.
- Added manual API key name input for GEMINI_API_KEY / custom keys.
- Google Connect now explains exactly what is wrong before opening OAuth.


## Telegram UI policy v18
Telegram Bot replies without automatic Mini App button. The panel is expected to be opened separately through Telegram Mini Apps / bot menu.


## v18 Admin access

Admin UI is hidden by default.

Open:

```text
https://projectseniorservice.bot-worker-tenj.workers.dev/admin?s=YOUR_ADMIN_SECRET
```

Opening `/admin` without the secret returns a private 404 screen.


## v22 Admin access

Open admin normally:

```text
https://projectseniorservice.bot-worker-tenj.workers.dev/admin
```

The admin screen accepts only the admin secret. Owner/family access codes are not displayed on the admin login screen.

## v22 SecureAPI / OpenAI-compatible setup
In Admin → API Keys add/update:

```text
OPENAI_API_KEY=sk-sec-...
OPENAI_BASE_URL=https://3xanny-secureapi.hf.space/v1
OPENAI_MODEL=gpt-5.4-mini
```

`gpt-5.4-mini` is safer for normal Telegram conversation. `gpt-5.5` is more expensive on providers with model multipliers.
