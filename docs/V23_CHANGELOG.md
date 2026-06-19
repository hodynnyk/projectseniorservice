# v23 Changelog · Sonya Life Core

## Core

- `sonya-v23-life-core-local-mood`
- Added persona profile API and live mood state.
- Added role-based mood packs.
- Added local-first Mini App data layer.

## Mini App

- Tasks can be marked Open/Postponed/Done.
- Body tab became a wellness center with local-only journal.
- System tab shows emotional/intellectual state, mode switcher and privacy state.
- Local device export/import/clear added.

## Assets

- 31 Sonya mood/action images optimized into WebP.
- Manifest: `src/assets/moodManifest.js` and `public/assets/moods/manifest.json`.
- Static assets served through Cloudflare Workers Assets binding.

## Telegram

- Task status intent handling.
- Photo vision without R2 storage.
- Search links for places, contacts, YouTube/media recommendations.

## Privacy

- Owner private, Family private and Shared layers are separated.
- Family gets only neutral family-safe moods.
- Owner-only spark/private mode is blocked for Family.
- Secrets are Owner-only.
