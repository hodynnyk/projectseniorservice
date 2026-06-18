import { getJson, putJson } from '../storage/kv.js';
import { nowIso } from '../utils/dates.js';

const OWNER_INACTIVITY_MS = 6 * 60 * 60 * 1000;

export async function beforeAssistantReply(env, user, source = 'bot') {
  const state = await getJson(env, `persona:${user.id}`, { interactionCount: 0, lastSeenAt: null, warmth: 1 });
  const now = Date.now();
  const last = state.lastSeenAt ? Date.parse(state.lastSeenAt) : 0;
  const inactive = last && now - last > OWNER_INACTIVITY_MS;
  const next = {
    interactionCount: Number(state.interactionCount || 0) + 1,
    lastSeenAt: nowIso(),
    warmth: Math.min(10, Number(state.warmth || 1) + 0.08),
    source
  };
  await putJson(env, `persona:${user.id}`, next);
  return { previous: state, next, inactive };
}

export function styleReply(user, text, ctx = {}) {
  const raw = String(text || '').trim();
  if (!raw) return raw;
  if (user?.role !== 'owner') return raw;
  const prefix = ctx.inactive ? ownerGreeting(new Date()) + '\n\n' : '';
  const gentle = shouldAddGentleTail(raw, ctx) ? '\n\nЯ поруч, сер.' : '';
  return prefix + raw + gentle;
}

export function ownerSystemPrompt(user, persona = {}) {
  if (user?.role !== 'owner') {
    return 'Стиль: сімейний, нейтральний, короткий, корисний. Не використовуй owner-звертання.';
  }
  return `Стиль для Owner: ти Соня, тепла приватна помічниця. Звертайся мʼяко: сер, господин, доброго вечору/ранку за контекстом. Будь уважною, трохи живою і делікатно грайливою, але без вульгарності, без перебору і без приниження. Не кажи прямо "я служу" кожного разу; краще коротко показуй готовність допомогти дією. Не зберігай дані без явного наміру. Якщо текст схожий на думку/ідею, спочатку уточни: записати, перетворити в задачу чи просто відповісти. Рівень адаптації: ${persona?.warmth || 1}/10.`;
}

export function wantsSaveExplicitly(lower) {
  return /^(запиши|збережи|сохрани|запомни|занеси|додай|добавь|створи|создай|note|save|add|create)\b/i.test(lower)
    || lower.includes('додай у покупки') || lower.includes('добавь в покупки')
    || lower.includes('запиши номер') || lower.includes('збережи це') || lower.includes('сохрани это');
}

export function needsClarificationBeforeSave(input, typeLabel = 'запис') {
  const clean = String(input || '').trim();
  return `Зрозуміла, сер. Це схоже на ${typeLabel}, але я не хочу бездумно заносити все в записи.\n\nСкажіть, що зробити: записати як нотатку, зробити задачу/нагадування, чи просто відповісти по суті?`;
}

function ownerGreeting(date) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'Доброго ранку, сер. Я вже на місці.';
  if (h >= 12 && h < 18) return 'Доброго дня, сер. Що бажаєте?';
  if (h >= 18 && h < 23) return 'Доброго вечору, господин. Я слухаю уважно.';
  return 'Вітаю, сер. Я поруч, тихо й уважно.';
}

function shouldAddGentleTail(text, ctx = {}) {
  if (!ctx.source || ctx.source.includes('telegram')) return false;
  if (text.length > 850) return false;
  if (/Я поруч|сер|господин/i.test(text)) return false;
  return false;
}
