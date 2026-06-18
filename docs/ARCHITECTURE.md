# Architecture

## Product architecture

`projectseniorservice` is a private family Соня OS with three faces and one core:

1. Telegram Bot — fast natural-language conversation.
2. Telegram Mini App — mobile control panel inside Telegram.
3. Web Admin — private browser admin center.

All three use the same Cloudflare Worker API, the same KV storage, the same users, tasks, memory, mail accounts, settings and activity log.

## Technical architecture

```txt
Cloudflare Worker
├─ /telegram/webhook/:secret
├─ /miniapp
├─ /admin
├─ /api/*
├─ scheduled cron every 5 minutes
├─ KV binding SONYA_KV
└─ optional D1 binding DB
```

## Storage strategy

v2 is KV-first because the user wants to upload ZIP to GitHub and avoid technical blockers.

KV keys use prefix:

```txt
pss:v2:
```

Main groups:

```txt
setup
settings
modules
users:ids / users:<id>
sessions:<token>
items:ids / items:<id>
activity:ids / activity:<id>
secrets:ids / secrets:<id>
mail:ids / mail:<id>
files:ids / files:<id>
```

D1 is already bound in `wrangler.jsonc` and has a starter migration in `migrations/0001_schema.sql`, but v2 does not require migrations to run.

## Data object model

Most life objects use one universal item shape:

```json
{
  "id": "item_x",
  "type": "task | reminder | note | mail | contact | file | expense | health | car | content | qa | calendar | system | list",
  "title": "string",
  "content": "string",
  "owner": "user_owner",
  "visibility": "private | shared",
  "createdAt": "ISO date",
  "updatedAt": "ISO date",
  "dueAt": "ISO date or null",
  "priority": "low | normal | high | urgent",
  "status": "open | in_progress | done | archived",
  "tags": [],
  "source": "telegram_bot | miniapp | admin | api",
  "linkedItems": [],
  "metadata": {}
}
```

## Module map

Modules:

```txt
mail, calendar, tasks, reminders, memory, contacts, files, family,
expenses, car, health, content, qa, admin, search, backup, google,
telegram, openai
```

Each module has storage, API handlers, UI entry points, permissions and activity log.

## Security model

- first setup creates admin secret and access codes;
- sessions are persistent for 90 days;
- Owner has admin access;
- Family sees shared data and own private data;
- API keys are masked in UI and export;
- every meaningful action goes to activity log;
- robots.txt blocks indexing;
- no secrets are printed into logs by default.
