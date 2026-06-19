# projectseniorservice · Соня v10

Приватна сімейна AI-система для Cloudflare Workers: Telegram Bot, Telegram Mini App і Web Admin працюють через один Worker та один KV/D1 контекст.

## v10 що додано

- Новий дружній **Sonya Center** в адмінці: Соня в центрі панелі, speech bubble, коментарі до змін.
- У Mini App теж доданий живий блок Соні з репліками й поясненням дій.
- `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_ENABLED` додані прямо в Admin → API Keys.
- Окремий блок **AI Providers**: OpenAI/GPT primary, Gemini sidecar, Google, Telegram.
- Кнопки тесту GPT і Gemini з адмінки.
- Google Gmail + Calendar модулі збережені.
- R2 залишається вимкненим: тільки metadata-only картки файлів.
- Voice/audio залишаються вимкненими для економії.
- Соня не зберігає все бездумно: якщо намір нечіткий, вона уточнює.
- Owner стиль: теплий, уважний, “сер/господин”, без перебору.
- Family reset з адмінки збережений.

## Основні маршрути

- `/admin` — Web Admin із Sonya Center.
- `/miniapp` — Telegram Mini App / mobile panel.
- `/route-check` — версія збірки.
- `/api/google/auth-url` — створення Google OAuth URL.
- `/api/google/gmail/list` — Gmail список.
- `/api/google/gmail/send` — Gmail send.
- `/api/google/calendar/events` — Google Calendar events.
- `/api/ai/gemini` — Gemini sidecar.

## Після деплою

1. Відкрий `/route-check` і перевір `sonya-v10-friendly-sonya-gemini-ui`.
2. Відкрий `/admin`.
3. У `API Keys` додай або перевір:
   - `OPENAI_API_KEY`
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL` = `gemini-2.5-flash`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
4. У Google Cloud OAuth Client додай redirect URI:

```text
https://projectseniorservice.bot-worker-tenj.workers.dev/api/google/callback
```

5. В Admin → Integrations або Google натисни `Connect Google`.
6. Після OAuth можна питати Соню:

```text
покажи Gmail
що в гугл пошті
що в календарі сьогодні
додай у календар завтра о 19:00 купити ліки
спитай Gemini поясни це простіше
```

## Політика файлів

R2 вимкнено. Соня не качає фото/голос/документи в сховище. Якщо користувач явно просить зберегти файл, створюється легка metadata-картка без binary-даних.

## Безпека

Gmail send не виконується “по здогадці”. Соня відправляє лист тільки коли є явний намір, email отримувача і текст листа.
