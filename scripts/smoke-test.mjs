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
const setup = await hit('/api/setup/status');
if (setup.data.configured !== false) throw new Error('Fresh KV must be unconfigured');
const first = await hit('/api/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ adminSecret: 'admin-secret-demo', ownerCode: 'owner123', familyCode: 'family123', publicBaseUrl: 'https://unit.test', apiKeys: { TELEGRAM_WEBHOOK_SECRET: 'telegram' } }) });
if (!first.data.token) throw new Error('First setup did not return session token');
const me = await hit('/api/me', { headers: { authorization: 'Bearer ' + first.data.token } });
if (me.data.user.role !== 'owner') throw new Error('Owner session failed');
const item = await hit('/api/items', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + first.data.token }, body: JSON.stringify({ type: 'task', title: 'Smoke task', visibility: 'shared' }) });
if (!item.data.item?.id) throw new Error('Item create failed');
console.log('SMOKE OK');
