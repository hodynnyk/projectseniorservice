import { listByIndex, upsertRecord, getJson } from '../storage/kv.js';
import { randomId } from '../utils/crypto.js';
import { nowIso } from '../utils/dates.js';
import { logActivity } from '../services/activity.js';

export async function uploadFile(env, user, request) {
  const contentType = request.headers.get('content-type') || '';
  let body = {};
  if (contentType.includes('application/json')) body = await request.json().catch(() => ({}));
  else {
    const form = await request.formData();
    for (const [k, v] of form.entries()) body[k] = typeof v === 'string' ? v : { name: v.name, type: v.type, size: v.size };
  }
  const file = {
    id: randomId('file'),
    owner: user.id,
    visibility: body.visibility === 'shared' ? 'shared' : 'private',
    title: String(body.title || body.name || 'Document').slice(0, 120),
    description: String(body.description || '').slice(0, 2000),
    mimeType: String(body.mimeType || body.type || '').slice(0, 100),
    size: Number(body.size || 0),
    tags: Array.isArray(body.tags) ? body.tags : String(body.tags || '').split(',').map(x => x.trim()).filter(Boolean),
    storage: env.SONYA_FILES ? 'r2_optional' : 'metadata_only',
    note: env.SONYA_FILES ? 'R2 binding detected; binary storage can be enabled in next build.' : 'KV-first build stores file metadata. Add R2 later for binary documents.',
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  await upsertRecord(env, 'files', file.id, file, [`files:user:${user.id}`]);
  await logActivity(env, { userId: user.id, source: 'api', module: 'files', action: 'register', objectId: file.id, message: file.title });
  return file;
}

export async function listFiles(env, user) {
  const rows = await listByIndex(env, 'files:ids', 'files', 1000);
  return rows.filter(row => user.role === 'owner' || row.visibility === 'shared' || row.owner === user.id);
}

export async function downloadFile(env, user, id) {
  const file = await getJson(env, `files:${id}`);
  if (!file) return new Response('Not found', { status: 404 });
  if (user.role !== 'owner' && file.visibility !== 'shared' && file.owner !== user.id) return new Response('Forbidden', { status: 403 });
  return new Response(JSON.stringify({ ok: true, file, note: 'Binary download requires optional R2 storage. This KV-first build keeps metadata so first deploy works with only KV.' }, null, 2), { headers: { 'content-type': 'application/json' } });
}
