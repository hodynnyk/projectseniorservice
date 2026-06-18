import { json, error, readJson, sanitizeString, cookie, getClientInfo, escapeHtml } from '../utils/http.js';
import { ensureStorage, exportAll } from '../storage/kv.js';
import { firstSetup, isConfigured, requireUser, loginWithAccessCode, loginWithAdminSecret, createInvite, verifyTelegramInitData, listUsers } from '../services/auth.js';
import { listItems, createItem, updateItem, deleteItem, todaySnapshot, searchItems } from '../modules/items.js';
import { handleNaturalInput } from '../ai/agent.js';
import { listActivity } from '../services/activity.js';
import { listApiKeys, setApiKey, deleteApiKey, listModules, setModuleEnabled, setSetting, getSetup, getApiKeyValue } from '../modules/settings.js';
import { createMailAccount, listMailAccounts, getInbox, sendMail } from '../modules/mail.js';
import { uploadFile, listFiles, downloadFile } from '../modules/files.js';
import { googleAuthUrl, googleCallback, googleStatus } from '../modules/google.js';
import { runReminderSweep } from '../services/reminders.js';
import { setTelegramWebhook } from '../telegram/bot.js';

export async function handleApi(env, request, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  await ensureStorage(env);

  if (path === '/api/health') {
    const setup = await getSetup(env);
    return json({ ok: true, service: 'projectseniorservice', time: new Date().toISOString(), configured: !!setup?.configured, bindings: { kv: !!env.SONYA_KV, d1: !!env.DB, r2: !!env.SONYA_FILES } });
  }

  if (path === '/api/setup/status') return json({ ok: true, configured: await isConfigured(env), setup: sanitizeSetup(await getSetup(env)) });

  if (path === '/api/setup' && method === 'POST') {
    const session = await firstSetup(env, await readJson(request), getClientInfo(request));
    return json({ ok: true, ...session }, 200, { 'set-cookie': cookie('sonya_session', session.token) });
  }

  if (path === '/api/auth/login' && method === 'POST') {
    const body = await readJson(request);
    const session = await loginWithAccessCode(env, { ...body, source: body.source || 'web' });
    return json({ ok: true, ...session }, 200, { 'set-cookie': cookie('sonya_session', session.token) });
  }

  if (path === '/api/auth/admin-secret' && method === 'POST') {
    const body = await readJson(request);
    const session = await loginWithAdminSecret(env, { secret: body.secret, source: 'admin' });
    return json({ ok: true, ...session }, 200, { 'set-cookie': cookie('sonya_session', session.token) });
  }

  if (path === '/api/auth/telegram-miniapp' && method === 'POST') {
    const body = await readJson(request);
    const token = body.botToken || await getApiKeyValue(env, 'TELEGRAM_BOT_TOKEN') || env.TELEGRAM_BOT_TOKEN || '';
    const tg = token ? await verifyTelegramInitData(body.initData, token) : null;
    if (body.initData && token && !tg) return error('Telegram initData validation failed', 401);
    const session = await loginWithAccessCode(env, { accessCode: body.accessCode || '', displayName: tg ? [tg.first_name, tg.last_name].filter(Boolean).join(' ') || tg.username : body.displayName, username: tg?.username || '', source: 'telegram_miniapp', telegramId: tg?.id || body.telegramId || '' });
    return json({ ok: true, ...session }, 200, { 'set-cookie': cookie('sonya_session', session.token) });
  }

  if (path === '/api/google/callback') {
    const result = await googleCallback(env, url.searchParams.get('code'), url.searchParams.get('state'));
    return new Response(`<html><body style="font-family:Inter,system-ui;background:#080b10;color:#e6fff0;padding:32px"><h1>${result.ok ? 'Google connected' : 'Google error'}</h1><pre>${escapeHtml(JSON.stringify(result,null,2))}</pre><script>setTimeout(()=>close(),1500)</script></body></html>`, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  }

  const user = await requireUser(env, request);

  if (path === '/api/me') return json({ ok: true, user });
  if (path === '/api/today') return json({ ok: true, data: await todaySnapshot(env, user) });
  if (path === '/api/search') return json({ ok: true, results: await searchItems(env, user, sanitizeString(url.searchParams.get('q') || '', 200), Number(url.searchParams.get('limit') || 80)) });

  if (path === '/api/ai/chat' && method === 'POST') {
    const body = await readJson(request);
    return json({ ok: true, result: await handleNaturalInput(env, user, body.text || '', body.source || 'miniapp') });
  }

  if (path === '/api/items' && method === 'GET') return json({ ok: true, items: await listItems(env, user, Object.fromEntries(url.searchParams)) });
  if (path === '/api/items' && method === 'POST') return json({ ok: true, item: await createItem(env, user, await readJson(request), 'api') });
  const itemMatch = path.match(/^\/api\/items\/([^/]+)$/);
  if (itemMatch && method === 'PUT') return json({ ok: true, item: await updateItem(env, user, itemMatch[1], await readJson(request), 'api') });
  if (itemMatch && method === 'DELETE') return json(await deleteItem(env, user, itemMatch[1], 'api'));

  if (path === '/api/mail/accounts' && method === 'GET') return json({ ok: true, accounts: await listMailAccounts(env, user) });
  if (path === '/api/mail/accounts' && method === 'POST') return json({ ok: true, account: await createMailAccount(env, user, await readJson(request), 'api') });
  const inboxMatch = path.match(/^\/api\/mail\/accounts\/([^/]+)\/inbox$/);
  if (inboxMatch && method === 'GET') return json({ ok: true, inbox: await getInbox(env, user, inboxMatch[1]) });
  const sendMatch = path.match(/^\/api\/mail\/accounts\/([^/]+)\/send$/);
  if (sendMatch && method === 'POST') return json(await sendMail(env, user, sendMatch[1], await readJson(request)));

  if (path === '/api/files' && method === 'GET') return json({ ok: true, files: await listFiles(env, user) });
  if (path === '/api/files' && method === 'POST') return json({ ok: true, file: await uploadFile(env, user, request) });
  const fileMatch = path.match(/^\/api\/files\/([^/]+)\/download$/);
  if (fileMatch && method === 'GET') return downloadFile(env, user, fileMatch[1]);

  if (path === '/api/google/status') return json({ ok: true, status: await googleStatus(env, user) });
  if (path === '/api/google/auth-url') return json(await googleAuthUrl(env, user));

  if (path.startsWith('/api/admin/')) assertOwner(user);
  if (path === '/api/admin/overview') {
    const [users, modules, keys, logs, setup] = await Promise.all([listUsers(env), listModules(env), listApiKeys(env), listActivity(env, user, { limit: 30 }), getSetup(env)]);
    return json({ ok: true, overview: { users, modules, keys, logs, setup: sanitizeSetup(setup), bindings: { kv: !!env.SONYA_KV, d1: !!env.DB, r2: !!env.SONYA_FILES } } });
  }
  if (path === '/api/admin/users' && method === 'GET') return json({ ok: true, users: await listUsers(env) });
  if (path === '/api/admin/invites' && method === 'POST') return json({ ok: true, invite: await createInvite(env, user, await readJson(request)) });
  if (path === '/api/admin/activity' && method === 'GET') return json({ ok: true, logs: await listActivity(env, user, Object.fromEntries(url.searchParams)) });
  if (path === '/api/admin/keys' && method === 'GET') return json({ ok: true, keys: await listApiKeys(env) });
  if (path === '/api/admin/keys' && method === 'POST') return json({ ok: true, key: await setApiKey(env, user, await readJson(request)) });
  const keyMatch = path.match(/^\/api\/admin\/keys\/([^/]+)$/);
  if (keyMatch && method === 'DELETE') return json(await deleteApiKey(env, user, keyMatch[1]));
  if (path === '/api/admin/modules' && method === 'GET') return json({ ok: true, modules: await listModules(env) });
  if (path === '/api/admin/modules' && method === 'POST') { const b = await readJson(request); return json({ ok: true, module: await setModuleEnabled(env, user, b.key, b.enabled) }); }
  if (path === '/api/admin/settings' && method === 'POST') { const b = await readJson(request); return json({ ok: true, setting: await setSetting(env, user, b.key, b.value, !!b.encrypted) }); }
  if (path === '/api/admin/export') return json(await exportAll(env), 200, { 'content-disposition': `attachment; filename="projectseniorservice-backup-${Date.now()}.json"` });
  if (path === '/api/admin/run-reminders' && method === 'POST') return json({ ok: true, result: await runReminderSweep(env) });
  if (path === '/api/admin/telegram/set-webhook' && method === 'POST') return json(await setTelegramWebhook(env));

  return error('Not found', 404);
}

function assertOwner(user) { if (user.role !== 'owner') throw Object.assign(new Error('Owner access required'), { status: 403 }); }
function sanitizeSetup(setup) { if (!setup) return null; const { adminSecretHash, ownerCodeHash, familyCodeHash, ...safe } = setup; return { ...safe, hasAdminSecret: !!adminSecretHash, hasOwnerCode: !!ownerCodeHash, hasFamilyCode: !!familyCodeHash }; }
