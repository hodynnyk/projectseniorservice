import { getJson, putJson, listByIndex, upsertRecord, deleteRecord, ensureModules } from '../storage/kv.js';
import { randomId, maskSecret } from '../utils/crypto.js';
import { nowIso } from '../utils/dates.js';
import { logActivity } from '../services/activity.js';

export async function getSetup(env) {
  return getJson(env, 'setup', null);
}

export async function setSetup(env, setup) {
  await putJson(env, 'setup', { ...setup, updatedAt: nowIso() });
}

export async function getSetting(env, key, fallback = null) {
  const settings = await getJson(env, 'settings', {});
  if (Object.hasOwn(settings, key)) return settings[key];
  if (key === 'PUBLIC_BASE_URL') {
    const setup = await getSetup(env);
    if (setup?.publicBaseUrl) return setup.publicBaseUrl;
    const ids = await getJson(env, 'secrets:ids', []);
    for (const id of ids) {
      const row = await getJson(env, `secrets:${id}`);
      if (row?.name === 'PUBLIC_BASE_URL') return row.value || fallback;
    }
  }
  return fallback;
}

export async function setSetting(env, user, k, value, encrypted = false) {
  const settings = await getJson(env, 'settings', {});
  settings[String(k)] = value;
  await putJson(env, 'settings', settings);
  await logActivity(env, { userId: user?.id, source: 'admin', module: 'settings', action: 'set', message: String(k), metadata: { encrypted } });
  return { key: String(k), value: encrypted ? '[hidden]' : value, encrypted };
}

export async function getApiKeyValue(env, name) {
  const ids = await getJson(env, 'secrets:ids', []);
  for (const id of ids) {
    const row = await getJson(env, `secrets:${id}`);
    if (row?.name === name) return row.value || '';
  }
  return env[name] || '';
}

export async function listApiKeys(env) {
  const rows = await listByIndex(env, 'secrets:ids', 'secrets', 1000);
  return rows.map(row => ({ ...row, value: row.value ? maskSecret(row.value) : '', hasValue: !!row.value }));
}

export async function setApiKey(env, user, body = {}) {
  const name = String(body.name || body.key || '').trim().replace(/[^A-Z0-9_]/gi, '_').toUpperCase();
  if (!name) throw Object.assign(new Error('API key name is required'), { status: 400 });
  const ids = await getJson(env, 'secrets:ids', []);
  let row = null;
  for (const id of ids) {
    const existing = await getJson(env, `secrets:${id}`);
    if (existing?.name === name) row = existing;
  }
  row = {
    id: row?.id || randomId('key'),
    name,
    value: String(body.value || ''),
    label: String(body.label || name),
    provider: String(body.provider || ''),
    active: body.active !== false,
    updatedAt: nowIso(),
    createdAt: row?.createdAt || nowIso()
  };
  await upsertRecord(env, 'secrets', row.id, row, []);
  await logActivity(env, { userId: user?.id, source: 'admin', module: 'keys', action: 'set', message: name });
  await refreshModuleCredentialStatus(env, name);
  return { ...row, value: maskSecret(row.value), hasValue: !!row.value };
}

export async function deleteApiKey(env, user, idOrName) {
  const rows = await listByIndex(env, 'secrets:ids', 'secrets', 1000);
  const row = rows.find(x => x.id === idOrName || x.name === idOrName);
  if (!row) return { ok: true, deleted: false };
  await deleteRecord(env, 'secrets', row.id, []);
  await logActivity(env, { userId: user?.id, source: 'admin', module: 'keys', action: 'delete', message: row.name });
  return { ok: true, deleted: true };
}

export async function listModules(env) {
  return ensureModules(env);
}

export async function setModuleEnabled(env, user, moduleKey, enabled) {
  const modules = await ensureModules(env);
  const next = modules.map(m => m.key === moduleKey ? { ...m, enabled: !!enabled, updatedAt: nowIso() } : m);
  await putJson(env, 'modules', next);
  await logActivity(env, { userId: user?.id, source: 'admin', module: 'modules', action: enabled ? 'enable' : 'disable', message: moduleKey });
  return next.find(m => m.key === moduleKey);
}

async function refreshModuleCredentialStatus(env, name) {
  const modules = await ensureModules(env);
  const map = { TELEGRAM_BOT_TOKEN: 'telegram', OPENAI_API_KEY: 'openai', GOOGLE_CLIENT_ID: 'google', GOOGLE_CLIENT_SECRET: 'google' };
  const mKey = map[name];
  if (!mKey) return;
  const next = modules.map(m => m.key === mKey ? { ...m, status: 'configured', updatedAt: nowIso() } : m);
  await putJson(env, 'modules', next);
}
