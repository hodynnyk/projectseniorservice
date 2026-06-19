# Testing · Соня v12

Run locally:

```bash
npm run check
npm run smoke
```

Manual after deploy:

1. `/route-check` shows `sonya-v12-ai-router-model-prompt`.
2. `/admin` opens.
3. Admin → API Keys shows Gemini/OpenAI keys.
4. Admin → AI Router opens.
5. Save active provider and fallback.
6. Test OpenAI.
7. Test Gemini.
8. Telegram bot answers using selected active provider.
9. If active provider has no key, Соня tries fallback.
