import worker from '../src/index.js';

class MemoryKV {
  constructor(){ this.map = new Map(); }
  async get(k){ return this.map.get(k) ?? null; }
  async put(k,v){ this.map.set(k,v); }
  async delete(k){ this.map.delete(k); }
}

const env = {
  SONYA_KV: new MemoryKV(),
  PROJECT_NAME: 'projectseniorservice',
  ASSISTANT_NAME: 'Соня',
  DEFAULT_TIMEZONE: 'Europe/Kyiv',
  MAIL_DOMAIN: 'web-library.net'
};
const ctx = { waitUntil(p){ return p; } };

async function hit(path, init) {
  const res = await worker.fetch(new Request('https://unit.test' + path, init), env, ctx);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (res.status >= 500) throw new Error(`${path} failed ${res.status}: ${text}`);
  return { res, data };
}

await hit('/api/health');
const route = await hit('/route-check');
if (route.data.version !== 'sonya-v5-telegram-autowebhook') throw new Error('Wrong route-check version');
const adminHtml = await hit('/admin');
if (!String(adminHtml.data).includes('Соня Admin')) throw new Error('/admin did not return Admin UI');
const miniHtml = await hit('/miniapp');
if (!String(miniHtml.data).includes('Соня Family OS')) throw new Error('/miniapp did not return Mini App UI');
const setup = await hit('/api/setup/status');
if (setup.data.configured !== false) throw new Error('Fresh KV must be unconfigured');
const autoLogin = await hit('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ accessCode: 'owner2026', publicBaseUrl: 'https://unit.test' }) });
if (autoLogin.data.user.role !== 'owner') throw new Error('Default owner auto-login failed');
const me = await hit('/api/me', { headers: { authorization: 'Bearer ' + autoLogin.data.token } });
if (me.data.user.role !== 'owner') throw new Error('Owner session failed');
const admin = await hit('/api/auth/admin-secret', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ secret: 'sonya-admin-2026', publicBaseUrl: 'https://unit.test' }) });
if (admin.data.user.role !== 'owner') throw new Error('Default admin-secret login failed');
const item = await hit('/api/items', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + autoLogin.data.token }, body: JSON.stringify({ type: 'task', title: 'Smoke task', visibility: 'shared' }) });
if (!item.data.item?.id) throw new Error('Item create failed');
console.log('SMOKE OK: v5 telegram/webhook/admin paths passed');
