# Setup · Соня v14

1. Upload the ZIP content to GitHub repo `projectseniorservice`.
2. Wait for Cloudflare deploy.
3. Open `/route-check` and confirm `sonya-v14-telegram-no-panel-buttons`.
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



## v14 Google visual fix
- Added real anime Соня visual from the provided reference as a Worker-served asset.
- Added Google OAuth Client ID preflight to prevent Google invalid_client screen.
- Added manual API key name input for GEMINI_API_KEY / custom keys.
- Google Connect now explains exactly what is wrong before opening OAuth.


## Telegram UI policy v14
Telegram Bot replies without automatic Mini App button. The panel is expected to be opened separately through Telegram Mini Apps / bot menu.
