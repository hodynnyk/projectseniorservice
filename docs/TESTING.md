# Testing · Соня v10

Після деплою перевір:

- `/route-check` показує `sonya-v10-friendly-sonya-gemini-ui`.
- `/admin` відкриває Sonya Center, а не чорний екран.
- Admin → API Keys має `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_ENABLED`.
- Admin → Integrations показує OpenAI primary і Gemini sidecar.
- Admin → Google показує OAuth redirect URI.
- `/miniapp` відкриває Соню Family OS.
- Telegram: `/start owner2026`.
- Telegram: `погода Обухів`.
- Telegram: `спитай Gemini коротко перевір себе`.
- Telegram: `що в Gmail` після OAuth.
- Telegram: `що в календарі сьогодні` після OAuth.

Локально в пакеті прогнано:

```text
npm run check
npm run smoke
```
