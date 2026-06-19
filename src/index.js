import { html, json, redirect, text, getPath } from './utils/http.js';
import { miniAppHtml } from './miniapp/ui.js';
import { adminHtml } from './admin/ui.js';
import { handleApi } from './routes/api.js';
import { handleTelegramWebhook } from './telegram/bot.js';
import { runReminderSweep } from './services/reminders.js';
import { ensureStorage } from './storage/kv.js';
import { sonyaGalleryResponse } from './assets/sonyaGallery.js';
import { getSetup } from './modules/settings.js';
import { hashAdmin, timingSafeStringEqual } from './utils/crypto.js';

export default {
  async fetch(request, env, ctx) {
    const path = getPath(request);
    try {
      const url = new URL(request.url);
      if (path === '/') return redirect('/miniapp');
      const assetMatch = path.match(/^\/assets\/sonya-(welcome-red|welcome|fitness|work|night|core|anime)\.webp$/);
      if (assetMatch) {
        const map = { 'welcome-red': 'welcome', 'anime': 'core' };
        return sonyaGalleryResponse(map[assetMatch[1]] || assetMatch[1]);
      }
      if (path === '/miniapp') return html(miniAppHtml());
      if (['/admin','/setup','/__admin','/sonya-admin','/admin-panel'].includes(path)) {
        await ensureStorage(env);
        if (!(await allowAdminHtml(env, url, path))) return privateNotFound();
        return html(adminHtml());
      }
      if (path === '/route-check') return json({ ok: true, version: 'sonya-v18-clean-miniapp-secure-admin', routes: { admin: '/admin?s=YOUR_ADMIN_SECRET', setup: '/setup?s=YOUR_ADMIN_SECRET', miniapp: '/miniapp' }, time: new Date().toISOString() });
      if (path === '/health') return json({ ok: true, service: 'projectseniorservice', version: 'sonya-v18-clean-miniapp-secure-admin', route: 'health', time: new Date().toISOString() });
      if (path === '/robots.txt') return text('User-agent: *\nDisallow: /\n');
      if (path.startsWith('/telegram/webhook')) {
        await ensureStorage(env);
        const expected = await resolveWebhookSecret(env);
        if (expected && !path.endsWith('/' + encodeURIComponent(expected)) && !path.endsWith('/' + expected)) {
          return json({ ok: false, error: 'bad webhook secret' }, 403);
        }
        return handleTelegramWebhook(env, request);
      }
      if (path.startsWith('/api/')) return handleApi(env, request, ctx);
      return json({ ok: false, error: 'not found' }, 404);
    } catch (err) {
      const message = err?.message || 'Unhandled error';
      return json({ ok: false, error: message }, err?.status || 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      await ensureStorage(env);
      await runReminderSweep(env);
    })());
  }
};

async function allowAdminHtml(env, url, path) {
  const setup = await getSetup(env);
  if (!setup?.configured) {
    // First setup is still reachable, but only on /setup to avoid showing admin login on the public /admin path.
    return path === '/setup';
  }
  const secret = String(url.searchParams.get('s') || '').trim();
  if (!secret) return false;
  const given = await hashAdmin(secret);
  return timingSafeStringEqual(given, setup.adminSecretHash);
}

function privateNotFound() {
  return new Response(`<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>404</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#070203;color:#c8a4ad;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial}.box{border:1px solid rgba(255,89,118,.18);border-radius:24px;padding:28px;background:rgba(28,8,13,.72);max-width:420px;text-align:center}b{color:#fff3f5}</style></head><body><div class="box"><b>404</b><br>Not found</div></body></html>`, {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
  });
}

async function resolveWebhookSecret(env) {
  try {
    const { getApiKeyValue } = await import('./modules/settings.js');
    return await getApiKeyValue(env, 'TELEGRAM_WEBHOOK_SECRET') || env.TELEGRAM_WEBHOOK_SECRET || 'telegram';
  } catch {
    return env.TELEGRAM_WEBHOOK_SECRET || 'telegram';
  }
}
