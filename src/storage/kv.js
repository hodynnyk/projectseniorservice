import { nowIso } from '../utils/dates.js';

const PREFIX = 'pss:v2:';
const INDEX_LIMIT = 5000;

export function key(name) { return `${PREFIX}${name}`; }

export async function ensureStorage(env) {
  if (!env.SONYA_KV) throw Object.assign(new Error('KV binding SONYA_KV is missing'), { status: 500 });
  const setup = await getJson(env, 'setup');
  if (!setup) {
    await putJson(env, 'runtime', { project: 'projectseniorservice', initialized: false, createdAt: nowIso() });
  }
  await ensureModules(env);
}

export async function getJson(env, name, fallback = null) {
  const raw = await env.SONYA_KV.get(key(name));
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

export async function putJson(env, name, value, options = {}) {
  return env.SONYA_KV.put(key(name), JSON.stringify(value ?? null), options);
}

export async function del(env, name) {
  return env.SONYA_KV.delete(key(name));
}

export async function appendIndex(env, indexName, id, max = INDEX_LIMIT) {
  const ids = await getJson(env, indexName, []);
  const next = [id, ...ids.filter(x => x !== id)].slice(0, max);
  await putJson(env, indexName, next);
  return next;
}

export async function removeIndex(env, indexName, id) {
  const ids = await getJson(env, indexName, []);
  await putJson(env, indexName, ids.filter(x => x !== id));
}

export async function listByIndex(env, indexName, itemPrefix, limit = 1000) {
  const ids = (await getJson(env, indexName, [])).slice(0, limit);
  const out = [];
  for (const id of ids) {
    const row = await getJson(env, `${itemPrefix}:${id}`);
    if (row) out.push(row);
  }
  return out;
}

export async function upsertRecord(env, type, id, record, indexes = []) {
  await putJson(env, `${type}:${id}`, record);
  await appendIndex(env, `${type}:ids`, id);
  for (const idx of indexes) await appendIndex(env, idx, id);
  return record;
}

export async function deleteRecord(env, type, id, indexes = []) {
  await del(env, `${type}:${id}`);
  await removeIndex(env, `${type}:ids`, id);
  for (const idx of indexes) await removeIndex(env, idx, id);
  return { ok: true };
}

export async function ensureModules(env) {
  const keys = ['mail','gmail','calendar','tasks','reminders','memory','contacts','files','family','expenses','car','health','fitness','nutrition','food_book','content','qa','admin','search','backup','google','gemini','telegram','openai','weather'];
  const make = (moduleKey) => ({
    key: moduleKey,
    enabled: true,
    status: ['google','gemini','openai','telegram'].includes(moduleKey) ? 'needs_credentials' : 'ready',
    updatedAt: nowIso(),
    settings: moduleKey === 'fitness' ? { goal: 'look_good_keep_weight', caution: 'not_medical_advice' } : moduleKey === 'nutrition' ? { mode: 'food_book_and_ration', autosave: 'explicit_only' } : {}
  });
  const existing = await getJson(env, 'modules');
  if (Array.isArray(existing) && existing.length) {
    const byKey = new Map(existing.map(m => [m.key, m]));
    let changed = false;
    for (const k of keys) if (!byKey.has(k)) { byKey.set(k, make(k)); changed = true; }
    const merged = Array.from(byKey.values());
    if (changed) await putJson(env, 'modules', merged);
    return merged;
  }
  const modules = keys.map(make);
  await putJson(env, 'modules', modules);
  return modules;
}

export async function compactActivity(env, max = 250) {
  const ids = await getJson(env, 'activity:ids', []);
  if (ids.length <= max) return;
  const keep = ids.slice(0, max);
  const drop = ids.slice(max);
  for (const id of drop) await del(env, `activity:${id}`);
  await putJson(env, 'activity:ids', keep);
}

export async function exportAll(env) {
  const setup = await getJson(env, 'setup');
  const users = await listByIndex(env, 'users:ids', 'users', 1000);
  const items = await listByIndex(env, 'items:ids', 'items', 5000);
  const activity = await listByIndex(env, 'activity:ids', 'activity', 1000);
  const mailAccounts = await listByIndex(env, 'mail:ids', 'mail', 1000);
  const files = await listByIndex(env, 'files:ids', 'files', 1000);
  const modules = await getJson(env, 'modules', []);
  const apiKeys = await listByIndex(env, 'secrets:ids', 'secrets', 1000);
  return { exportedAt: nowIso(), project: 'projectseniorservice', setup: setup ? { ...setup, adminSecretHash: !!setup.adminSecretHash } : null, users, items, activity, mailAccounts, files, modules, apiKeys: apiKeys.map(k => ({ ...k, value: k.value ? '[hidden]' : '' })) };
}
