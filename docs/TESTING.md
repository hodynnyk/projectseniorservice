# TESTING · Соня v8

## Route check

```json
{
  "version": "sonya-v8-no-r2-personality-family-reset"
}
```

## Manual checklist

- `/route-check` показує v8.
- `/admin` відкриває Admin UI.
- `/miniapp` відкриває Family OS.
- Admin login через `sonya-admin-2026`.
- Owner login через `owner2026`.
- API Keys → Telegram status → Set / Repair webhook.
- Telegram `/start owner2026`.
- Telegram `погода Обухів`.
- Telegram voice/audio → бот відповідає, що voice вимкнено.
- Telegram фото без підпису → бот не зберігає.
- Telegram фото з підписом `збережи як документ` → створюється metadata-картка без R2.
- Admin → Users → Reset Family account → safe reset працює.

## Local checks used before ZIP

```bash
npm run check
npm run smoke
```

Expected:

```text
SMOKE OK: v8 no-r2/personality/family-reset paths passed
```
