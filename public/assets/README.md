# Assets

Static assets are served by Cloudflare Workers Assets binding (`env.ASSETS`).

## Mood/action assets

`public/assets/moods/*.webp` contains optimized Sonya status stickers.

Rules:

- Do not load the full pack at once.
- Use the manifest to select by role/context.
- Family: only `familySafe: true` assets.
- Owner: full private pack is allowed, including `spark`/private mode.
- R2 remains disabled; these are bundled static deploy assets.
