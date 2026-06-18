import { html, json, redirect, text, getPath } from './utils/http.js';
import { miniAppHtml } from './miniapp/ui.js';
import { adminHtml } from './admin/ui.js';
import { handleApi } from './routes/api.js';
import { handleTelegramWebhook } from './telegram/bot.js';
import { runReminderSweep } from './services/reminders.js';
import { ensureStorage } from './storage/kv.js';

export default {
  async fetch(request, env, ctx) {
    const path = getPath(request);
    try {
      if (path === '/') return redirect('/admin');
      if (path === '/miniapp') return html(miniAppHtml());
      if (['/admin','/setup','/__admin','/sonya-admin','/admin-panel'].includes(path)) return html(adminHtml());
      if (path === '/route-check') return json({ ok: true, version: 'sonya-v4-ui-login-fix', routes: { admin: '/admin', setup: '/setup', miniapp: '/miniapp' }, time: new Date().toISOString() });
      if (path === '/health') return json({ ok: true, service: 'projectseniorservice', version: 'sonya-v4-ui-login-fix', route: 'health', time: new Date().toISOString() });
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

async function resolveWebhookSecret(env) {
  try {
    const { getApiKeyValue } = await import('./modules/settings.js');
    return await getApiKeyValue(env, 'TELEGRAM_WEBHOOK_SECRET') || env.TELEGRAM_WEBHOOK_SECRET || 'telegram';
  } catch {
    return env.TELEGRAM_WEBHOOK_SECRET || 'telegram';
  }
}
