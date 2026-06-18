import { listByIndex, upsertRecord, getJson, deleteRecord } from '../storage/kv.js';
import { randomId } from '../utils/crypto.js';
import { nowIso } from '../utils/dates.js';
import { logActivity } from '../services/activity.js';

/**
 * v8 file policy: no R2, no binary persistence.
 * We keep only lightweight metadata cards in KV so the bot stays functional
 * without burning the 10 GB/month R2 storage budget.
 */
export async function uploadFile(env, user, request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file') || firstFile(form);
    return registerFileMetadata(env, user, {
      name: file && typeof file !== 'string' ? file.name : String(form.get('name') || 'File'),
      title: String(form.get('title') || (file && typeof file !== 'string' ? file.name : 'File')),
      description: String(form.get('description') || ''),
      mimeType: file && typeof file !== 'string' ? file.type : String(form.get('mimeType') || ''),
      size: file && typeof file !== 'string' ? file.size : Number(form.get('size') || 0),
      visibility: String(form.get('visibility') || 'private'),
      tags: String(form.get('tags') || '').split(',').map(x => x.trim()).filter(Boolean),
      source: 'miniapp',
      metadata: { uploadMode: 'metadata_only', reason: 'R2 disabled by owner policy' }
    });
  }

  const body = contentType.includes('application/json') ? await request.json().catch(() => ({})) : {};
  return registerFileMetadata(env, user, { ...body, source: body.source || 'api', metadata: { ...(body.metadata || {}), uploadMode: 'metadata_only', reason: 'R2 disabled by owner policy' } });
}

export async function storeBinaryFile(env, user, input = {}) {
  // Compatibility wrapper for older callers. It deliberately does NOT write to R2.
  return registerFileMetadata(env, user, {
    name: input.name || input.title || 'Telegram file',
    title: input.title || input.name || 'Telegram file',
    description: input.description || '',
    mimeType: input.mimeType || input.blob?.type || 'application/octet-stream',
    size: Number(input.size || input.blob?.size || 0),
    visibility: input.visibility || 'private',
    tags: input.tags || [],
    source: input.source || 'api',
    metadata: { ...(input.metadata || {}), uploadMode: 'metadata_only', binaryStored: false, reason: 'R2 disabled by owner policy' }
  });
}

export async function registerFileMetadata(env, user, body = {}) {
  const now = nowIso();
  const file = {
    id: randomId('file'),
    owner: user.id,
    visibility: body.visibility === 'shared' ? 'shared' : 'private',
    title: String(body.title || body.name || 'File card').slice(0, 160),
    description: String(body.description || '').slice(0, 4000),
    mimeType: String(body.mimeType || body.type || '').slice(0, 120),
    size: Number(body.size || 0),
    tags: Array.isArray(body.tags) ? body.tags.slice(0, 30) : String(body.tags || '').split(',').map(x => x.trim()).filter(Boolean),
    storage: 'metadata_only',
    bucket: '',
    objectKey: '',
    downloadUrl: '',
    canDownload: false,
    note: 'R2 вимкнено за політикою Owner. Збережено тільки легку картку файлу без binary-даних, щоб не витрачати 10 GB/month.',
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
    createdAt: now,
    updatedAt: now
  };
  await upsertRecord(env, 'files', file.id, file, [`files:user:${user.id}`]);
  await logActivity(env, { userId: user.id, source: body.source || 'api', module: 'files', action: 'metadata_register', objectId: file.id, message: file.title, metadata: { size: file.size, mimeType: file.mimeType, visibility: file.visibility, storage: file.storage } });
  return file;
}

export async function listFiles(env, user) {
  const rows = await listByIndex(env, 'files:ids', 'files', 1000);
  return rows.filter(row => user.role === 'owner' || row.visibility === 'shared' || row.owner === user.id)
    .map(row => ({ ...row, canDownload: false, downloadUrl: '' }));
}

export async function downloadFile(env, user, id) {
  const file = await getJson(env, `files:${id}`);
  if (!file) return new Response('Not found', { status: 404 });
  if (user.role !== 'owner' && file.visibility !== 'shared' && file.owner !== user.id) return new Response('Forbidden', { status: 403 });
  return new Response(JSON.stringify({ ok: true, file, note: 'R2/binary storage disabled. This is a metadata-only file card.' }, null, 2), { headers: { 'content-type': 'application/json; charset=utf-8' } });
}

export async function deleteFileRecordAndObject(env, user, id, source = 'admin') {
  const file = await getJson(env, `files:${id}`);
  if (!file) return { ok: true, deleted: false };
  await deleteRecord(env, 'files', id, [`files:user:${file.owner}`]);
  await logActivity(env, { userId: user?.id, source, module: 'files', action: 'delete_metadata', objectId: id, message: file.title, metadata: { owner: file.owner, visibility: file.visibility } });
  return { ok: true, deleted: true };
}

export async function r2Status() {
  return {
    ok: true,
    disabled: true,
    storageMode: 'metadata_only',
    usage: { uploadedBytes: 0, uploadedGb: 0, monthlyLimitGb: 10, softLimitGb: 9.8, locked: true, lockReason: 'disabled_by_owner_policy' },
    policy: { rule: 'R2 is intentionally disabled in v8. Files/photos are not downloaded or persisted; only metadata cards are saved on explicit request.' }
  };
}

function firstFile(form) {
  for (const [, v] of form.entries()) if (v && typeof v !== 'string') return v;
  return null;
}
