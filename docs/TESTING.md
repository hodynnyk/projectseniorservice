# Testing · Соня v18

Run locally:

```bash
npm run check
npm run smoke
```

Manual after deploy:

1. `/route-check` shows `sonya-v22-openai-base-url-secureapi`.
2. `/admin` opens.
3. Admin → API Keys shows Gemini/OpenAI keys.
4. Admin → AI Router opens.
5. Save active provider and fallback.
6. Test OpenAI.
7. Test Gemini.
8. Telegram bot answers using selected active provider.
9. If active provider has no key, Соня tries fallback.


## v18 Google account picker + welcome avatar
- Added real anime Соня visual from the provided reference as a Worker-served asset.
- Added Google OAuth Client ID preflight to prevent Google invalid_client screen.
- Added manual API key name input for GEMINI_API_KEY / custom keys.
- Google Connect now explains exactly what is wrong before opening OAuth.


## Telegram UI policy v18
Telegram Bot replies without automatic Mini App button. The panel is expected to be opened separately through Telegram Mini Apps / bot menu.
