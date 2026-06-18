# Cloudflare free tier notes

This build is designed to be light.

## KV-first reason

KV has enough capacity for a private family assistant with tasks, notes, small metadata and logs. It avoids requiring database migrations for the first deploy.

## Limits considered

- Activity log is compacted to about 300 recent records.
- Item list reads are capped.
- Reminder sweep processes a limited batch per cron run.
- Files are metadata-only unless R2 is later enabled.
- OpenAI calls are made only when local intent routing is not enough.

## When to add D1

Add D1-heavy logic later when you need:

- thousands of records;
- advanced filters;
- relational reports;
- expense analytics;
- faster admin tables.

The D1 binding is already configured:

```txt
binding: DB
name: projectseniorservice
id: 00000001-00000000-0000508e-c84a51b9d54805a1944eec20354b3faa
```

## When to add R2

Add R2 when you want real binary storage for:

- photos;
- PDFs;
- scanned documents;
- checks;
- warranties.

v2 stores file metadata and is prepared for R2 extension later.
