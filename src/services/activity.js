import { appendIndex, getJson, putJson, listByIndex, compactActivity } from '../storage/kv.js';
import { randomId } from '../utils/crypto.js';
import { nowIso } from '../utils/dates.js';

export async function logActivity(env, entry = {}) {
  const id = randomId('log');
  const row = {
    id,
    userId: entry.userId || entry.user?.id || null,
    source: entry.source || 'system',
    module: entry.module || 'core',
    action: entry.action || 'event',
    objectId: entry.objectId || null,
    message: String(entry.message || '').slice(0, 500),
    metadata: entry.metadata || {},
    createdAt: nowIso()
  };
  await putJson(env, `activity:${id}`, row);
  await appendIndex(env, 'activity:ids', id, 500);
  await compactActivity(env, 300);
  return row;
}

export async function listActivity(env, user, params = {}) {
  const limit = Math.min(300, Number(params.limit || 80));
  const rows = await listByIndex(env, 'activity:ids', 'activity', limit * 2);
  return rows.filter(row => {
    if (params.userId && row.userId !== params.userId) return false;
    if (params.module && row.module !== params.module) return false;
    if (user?.role !== 'owner' && row.userId && row.userId !== user.id) return false;
    return true;
  }).slice(0, limit);
}
