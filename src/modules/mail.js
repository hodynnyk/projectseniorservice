import { getJson, listByIndex, upsertRecord } from '../storage/kv.js';
import { randomId } from '../utils/crypto.js';
import { nowIso } from '../utils/dates.js';
import { logActivity } from '../services/activity.js';
import { getApiKeyValue } from './settings.js';

export async function createMailAccount(env, user, body = {}, source = 'api') {
  const local = cleanLocal(body.local || body.name || randomLocal());
  const account = {
    id: randomId('mail'),
    owner: user.id,
    visibility: body.visibility === 'shared' ? 'shared' : 'private',
    address: `${local}@${env.MAIL_DOMAIN || 'web-library.net'}`,
    local,
    domain: env.MAIL_DOMAIN || 'web-library.net',
    label: String(body.label || local).slice(0, 80),
    passwordHint: body.password ? 'saved_by_user' : '',
    password: String(body.password || ''),
    provider: 'web-library.net-adapter',
    status: 'registered_locally',
    note: 'web-library.net public page does not expose a documented outbound sending API. This module stores accounts and supports inbox adapter if legal endpoint is configured.',
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  await upsertRecord(env, 'mail', account.id, account, [`mail:user:${user.id}`]);
  await logActivity(env, { userId: user.id, source, module: 'mail', action: 'create_account', objectId: account.id, message: account.address });
  return maskMail(account);
}

export async function listMailAccounts(env, user) {
  const rows = await listByIndex(env, 'mail:ids', 'mail', 1000);
  return rows.filter(row => user.role === 'owner' || row.visibility === 'shared' || row.owner === user.id).map(maskMail);
}

export async function getInbox(env, user, accountId) {
  const account = await getJson(env, `mail:${accountId}`);
  if (!account) throw Object.assign(new Error('Mail account not found'), { status: 404 });
  if (user.role !== 'owner' && account.visibility !== 'shared' && account.owner !== user.id) throw Object.assign(new Error('No access to mail account'), { status: 403 });
  const adapterUrl = await getApiKeyValue(env, 'WEB_LIBRARY_INBOX_ENDPOINT');
  if (!adapterUrl) {
    return {
      account: maskMail(account),
      messages: [],
      adapter: 'not_configured',
      note: 'Inbox endpoint is not configured. Add WEB_LIBRARY_INBOX_ENDPOINT in Admin > API Keys if you have a legal endpoint/session adapter.'
    };
  }
  try {
    const res = await fetch(adapterUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: account.address, password: account.password }) });
    const data = await res.json().catch(() => ({}));
    return { account: maskMail(account), messages: Array.isArray(data.messages) ? data.messages : [], adapter: res.ok ? 'ok' : 'error', rawStatus: res.status };
  } catch (err) {
    return { account: maskMail(account), messages: [], adapter: 'error', error: err.message };
  }
}

export async function sendMail(env, user, accountId, body = {}) {
  const account = await getJson(env, `mail:${accountId}`);
  if (!account) throw Object.assign(new Error('Mail account not found'), { status: 404 });
  if (user.role !== 'owner' && account.owner !== user.id) throw Object.assign(new Error('No access to mail account'), { status: 403 });
  const resendKey = await getApiKeyValue(env, 'RESEND_API_KEY');
  if (!resendKey) {
    return { ok: false, skipped: true, reason: 'Outbound sending is disabled. web-library.net is treated as receive/read/local registry. Add RESEND_API_KEY or custom SMTP/API provider to enable sending.' };
  }
  const from = String(body.from || account.address);
  const payload = { from, to: String(body.to || '').split(',').map(x => x.trim()).filter(Boolean), subject: String(body.subject || 'Sonia message'), text: String(body.text || body.body || '') };
  if (!payload.to.length || !payload.text) throw Object.assign(new Error('Recipient and text are required'), { status: 400 });
  const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await res.json().catch(() => ({}));
  await logActivity(env, { userId: user.id, source: 'api', module: 'mail', action: 'send', objectId: account.id, message: payload.subject, metadata: { ok: res.ok, status: res.status } });
  return { ok: res.ok, status: res.status, data };
}

function cleanLocal(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').replace(/^\.+|\.+$/g, '').slice(0, 48) || randomLocal();
}
function randomLocal() { return `sonya-${Math.random().toString(36).slice(2, 10)}`; }
function maskMail(a) { const { password, ...rest } = a; return { ...rest, hasPassword: !!password }; }
