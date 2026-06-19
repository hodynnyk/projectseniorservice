import { getJson, listByIndex, upsertRecord, deleteRecord } from '../storage/kv.js';
import { randomId } from '../utils/crypto.js';
import { nowIso, startOfLocalDayIso, endOfLocalDayIso } from '../utils/dates.js';
import { logActivity } from '../services/activity.js';

const TYPES = new Set(['task','reminder','note','mail','contact','file','expense','health','car','content','qa','calendar','system','list','workout','nutrition','meal','food_book']);

export async function createItem(env, user, body = {}, source = 'api') {
  const now = nowIso();
  const item = normalizeItem({
    id: randomId('item'),
    type: body.type,
    title: body.title,
    content: body.content,
    owner: user.id,
    visibility: body.visibility || (user.privateModeDefault ? 'private' : 'shared'),
    createdAt: now,
    updatedAt: now,
    dueAt: body.dueAt || null,
    priority: body.priority || 'normal',
    status: body.status || 'open',
    tags: body.tags || [],
    source,
    linkedItems: body.linkedItems || [],
    metadata: body.metadata || {}
  });
  await upsertRecord(env, 'items', item.id, item, [`items:user:${user.id}`]);
  await logActivity(env, { userId: user.id, source, module: item.type, action: 'create', objectId: item.id, message: item.title });
  return item;
}

export async function updateItem(env, user, id, patch = {}, source = 'api') {
  const existing = await getJson(env, `items:${id}`);
  if (!existing) throw Object.assign(new Error('Item not found'), { status: 404 });
  assertCanAccess(user, existing, true);
  const item = normalizeItem({ ...existing, ...patch, id: existing.id, owner: existing.owner, createdAt: existing.createdAt, updatedAt: nowIso() });
  await upsertRecord(env, 'items', item.id, item, [`items:user:${item.owner}`]);
  await logActivity(env, { userId: user.id, source, module: item.type, action: 'update', objectId: item.id, message: item.title });
  return item;
}

export async function deleteItem(env, user, id, source = 'api') {
  const existing = await getJson(env, `items:${id}`);
  if (!existing) return { ok: true, deleted: false };
  assertCanAccess(user, existing, true);
  await deleteRecord(env, 'items', id, [`items:user:${existing.owner}`]);
  await logActivity(env, { userId: user.id, source, module: existing.type, action: 'delete', objectId: id, message: existing.title });
  return { ok: true, deleted: true };
}

export async function listItems(env, user, params = {}) {
  const limit = Math.min(500, Number(params.limit || 120));
  let rows = await listByIndex(env, 'items:ids', 'items', 5000);
  rows = rows.filter(item => canRead(user, item));
  if (params.type) rows = rows.filter(x => x.type === params.type);
  if (params.status) rows = rows.filter(x => x.status === params.status);
  if (params.visibility) rows = rows.filter(x => x.visibility === params.visibility);
  if (params.tag) rows = rows.filter(x => (x.tags || []).includes(params.tag));
  rows.sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return rows.slice(0, limit);
}

export async function searchItems(env, user, q = '', limit = 80) {
  const query = String(q || '').trim().toLowerCase();
  if (!query) return listItems(env, user, { limit });
  const rows = await listItems(env, user, { limit: 1000 });
  return rows.map(item => ({ item, score: scoreItem(item, query) })).filter(x => x.score > 0).sort((a,b) => b.score - a.score).slice(0, limit).map(x => x.item);
}

export async function todaySnapshot(env, user) {
  const rows = await listItems(env, user, { limit: 1000 });
  const now = nowIso();
  const start = startOfLocalDayIso();
  const end = endOfLocalDayIso();
  const open = rows.filter(x => x.status !== 'done');
  const today = open.filter(x => x.dueAt && x.dueAt >= start && x.dueAt <= end).sort(sortDue);
  const overdue = open.filter(x => x.dueAt && x.dueAt < now).sort(sortDue);
  const next = open.filter(x => x.dueAt && x.dueAt >= now).sort(sortDue).slice(0, 8);
  const recent = rows.slice(0, 8);
  const important = open.filter(x => x.priority === 'high').slice(0, 8);
  return { today, overdue, next, recent, important, counts: { open: open.length, today: today.length, overdue: overdue.length, all: rows.length } };
}

export async function dueReminderItems(env) {
  const rows = await listByIndex(env, 'items:ids', 'items', 5000);
  const now = nowIso();
  return rows.filter(x => ['task','reminder'].includes(x.type) && x.status !== 'done' && x.dueAt && x.dueAt <= now && !x.metadata?.lastNotifiedAt);
}

function normalizeItem(item) {
  const title = String(item.title || item.content || 'New item').replace(/\s+/g, ' ').trim().slice(0, 160);
  const type = TYPES.has(item.type) ? item.type : 'note';
  return {
    id: item.id,
    type,
    title: title || 'New item',
    content: String(item.content || '').slice(0, 12000),
    owner: item.owner,
    visibility: item.visibility === 'shared' ? 'shared' : 'private',
    createdAt: item.createdAt || nowIso(),
    updatedAt: item.updatedAt || nowIso(),
    dueAt: item.dueAt || null,
    priority: ['low','normal','high','urgent'].includes(item.priority) ? item.priority : 'normal',
    status: ['open','in_progress','done','archived'].includes(item.status) ? item.status : 'open',
    tags: Array.isArray(item.tags) ? item.tags.map(x => String(x).slice(0, 40)).slice(0, 20) : [],
    source: String(item.source || 'api').slice(0, 40),
    linkedItems: Array.isArray(item.linkedItems) ? item.linkedItems.slice(0, 30) : [],
    metadata: item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
  };
}

function canRead(user, item) {
  if (!item) return false;
  if (user.role === 'owner') return true;
  if (item.visibility === 'shared') return true;
  return item.owner === user.id;
}

function assertCanAccess(user, item, write = false) {
  if (!canRead(user, item)) throw Object.assign(new Error('No access to item'), { status: 403 });
  if (write && user.role !== 'owner' && item.owner !== user.id) throw Object.assign(new Error('No write access to item'), { status: 403 });
}

function scoreItem(item, query) {
  const hay = [item.title, item.content, item.type, item.visibility, ...(item.tags || []), JSON.stringify(item.metadata || {})].join(' ').toLowerCase();
  let score = 0;
  for (const part of query.split(/\s+/).filter(Boolean)) {
    if (hay.includes(part)) score += item.title.toLowerCase().includes(part) ? 5 : 1;
  }
  return score;
}

function sortDue(a, b) { return String(a.dueAt || '').localeCompare(String(b.dueAt || '')); }
