# Architecture · Соня v12

## Interfaces

- Telegram Bot: natural language commands and AI answers.
- Telegram Mini App: family panel.
- Web Admin: Owner control center.

## AI Router

All non-tool fallback AI answers go through `src/ai/router.js`.

Flow:

```text
Telegram text → agent intent detection → tools if exact intent → AI Router if general answer
```

AI Router:

1. Loads `TELEGRAM_AI_PROVIDER`.
2. Loads `AI_FALLBACK_PROVIDER`.
3. Loads `SONYA_BASE_PROMPT`.
4. Tries active provider.
5. If provider is missing or fails, tries fallback.
6. Logs attempts in activity.

Providers:

- `src/ai/openai.js`
- `src/modules/gemini.js`

The same base prompt is supplied to both providers, so Соня keeps the same behavior when switching models.
