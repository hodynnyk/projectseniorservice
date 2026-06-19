# Setup · Соня v12

1. Upload the ZIP content to GitHub repo `projectseniorservice`.
2. Wait for Cloudflare deploy.
3. Open `/route-check` and confirm `sonya-v12-ai-router-model-prompt`.
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

