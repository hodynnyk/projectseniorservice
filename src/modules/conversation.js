import { getJson, putJson } from '../storage/kv.js';
import { nowIso } from '../utils/dates.js';

const MAX_TURNS = 18;

export async function getConversationContext(env, user, source = 'telegram_bot') {
  if (!user?.id) return [];
  const key = historyKey(user.id, source);
  const history = await getJson(env, key, []);
  return Array.isArray(history) ? history.slice(-MAX_TURNS) : [];
}

export async function appendConversationTurn(env, user, source, role, text, metadata = {}) {
  if (!user?.id || !text) return [];
  const key = historyKey(user.id, source);
  const history = await getConversationContext(env, user, source);
  const row = {
    role: String(role || 'user').slice(0, 20),
    text: String(text || '').replace(/\s+/g, ' ').trim().slice(0, 1200),
    at: nowIso(),
    metadata: metadata && typeof metadata === 'object' ? metadata : {}
  };
  const next = [...history, row].slice(-MAX_TURNS);
  await putJson(env, key, next);
  return next;
}

export async function clearConversationContext(env, user, source = 'telegram_bot') {
  if (!user?.id) return { ok: false };
  await putJson(env, historyKey(user.id, source), []);
  return { ok: true };
}

function historyKey(userId, source) {
  return `conversation:${String(source || 'telegram_bot')}:${String(userId)}`;
}
