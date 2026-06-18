import { createItem, searchItems, listItems } from '../modules/items.js';
import { askOpenAI } from './openai.js';
import { parseLooseDueAt, formatShort } from '../utils/dates.js';
import { logActivity } from '../services/activity.js';
import { isWeatherIntent, getWeatherForText } from '../modules/weather.js';
import { beforeAssistantReply, styleReply, ownerSystemPrompt, wantsSaveExplicitly, needsClarificationBeforeSave } from './personality.js';

export async function handleNaturalInput(env, user, text, source = 'bot') {
  const input = String(text || '').trim();
  const persona = user ? await beforeAssistantReply(env, user, source) : { inactive: false, next: {} };
  const finish = (payload) => ({ ...payload, text: styleReply(user, payload.text, { inactive: persona.inactive, source }) });

  if (!input) return finish({ text: user?.role === 'owner' ? 'Я поруч, сер. Напишіть команду або киньте думку — я акуратно розберу.' : 'Я поруч. Напиши команду або кинь задачу.' });
  const lower = input.toLowerCase();
  const explicitSave = wantsSaveExplicitly(lower);

  if (isWeatherIntent(input)) {
    const result = await getWeatherForText(env, user, input, source);
    return finish(result);
  }

  if (hasAny(lower, ['що сьогодні','что сегодня','today','план дня','сьогодні'])) {
    const active = (await listItems(env, user, { limit: 50 })).filter(x => x.status !== 'done').slice(0, 12);
    return finish({ text: active.length ? `Активне:\n${active.map((x,i)=>`${i+1}. ${x.title}${x.dueAt ? ' — '+formatShort(x.dueAt) : ''}`).join('\n')}` : 'Активних задач поки немає.' });
  }

  if (starts(lower, ['знайди','найди','search'])) {
    const q = input.replace(/^(знайди|найди|search)\s*/i, '').trim();
    const results = await searchItems(env, user, q, 12);
    return finish({ text: results.length ? `Знайшов:\n${results.map((x,i)=>`${i+1}. [${x.type}] ${x.title}`).join('\n')}` : 'Нічого не знайшов у пам’яті.' });
  }

  if (hasAny(lower, ['нагадай','напомни','remind','через','завтра','tomorrow','кожного','каждый'])) {
    const due = parseLooseDueAt(input, env.DEFAULT_TIMEZONE || 'Europe/Kyiv');
    const item = await createItem(env, user, {
      type: 'reminder', title: cleanupTitle(input), content: input, dueAt: due.dueAt,
      visibility: hasAny(lower, ['друж','жене','сім','сем','family']) ? 'shared' : 'private',
      priority: hasAny(lower, ['важ','urgent','срочно']) ? 'high' : 'normal',
      tags: ['reminder'], metadata: { recurrence: due.recurrence, parsedFrom: input, timezone: due.timezone }
    }, source);
    return finish({ text: `Готово. Записала: ${item.title}${item.dueAt ? `\nКоли: ${formatShort(item.dueAt)}` : '\nЧас не побачила, тому залишила як нагадування без дати.'}`, item });
  }

  if (hasAny(lower, ['покуп','купить','shopping','додай у покупки','добавь в покупки'])) {
    if (!explicitSave && !hasAny(lower, ['додай','добавь','купити','купить'])) return finish({ text: needsClarificationBeforeSave(input, 'сімейний список покупок') });
    const item = await createItem(env, user, { type: 'list', title: cleanupTitle(input), content: input, visibility: 'shared', tags: ['shopping'], metadata: { list: 'shopping' } }, source);
    return finish({ text: `Додала у сімейні покупки: ${item.title}`, item });
  }

  if (hasAny(lower, ['запиши номер','номер майстра','телефон','контакт'])) {
    if (!explicitSave && !hasAny(lower, ['запиши номер','сохрани номер','збережи номер'])) return finish({ text: needsClarificationBeforeSave(input, 'контакт') });
    const phone = input.match(/[+]?[0-9][0-9\s().-]{6,}/)?.[0]?.trim() || '';
    const item = await createItem(env, user, { type: 'contact', title: cleanupTitle(input).slice(0,80), content: input, visibility: lower.includes('private') ? 'private' : 'shared', tags: ['contact'], metadata: { phone } }, source);
    return finish({ text: `Контакт збережено${phone ? ': '+phone : ''}.`, item });
  }

  const typeRules = [
    ['expense', ['витрат','расход','потрат','грн','uah','₴']],
    ['car', ['авто','машин','kia','сефія','sephia','патруб','антифриз','ремонт']],
    ['health', ['здоров','ліки','лекар','бол','температур','симптом']],
    ['content', ['youtube','ютуб','відео','видео','превью','thumbnail','shorts']],
    ['qa', ['qa','баг','bug','test case','тест-кейс','apk','лог']]
  ];
  for (const [type, keys] of typeRules) {
    if (keys.some(k => lower.includes(k))) {
      if (!explicitSave) return finish({ text: needsClarificationBeforeSave(input, `можливий ${label(type)}-запис`) });
      const item = await createItem(env, user, { type, title: cleanupTitle(input), content: input, visibility: 'private', tags: [type], metadata: { capturedBy: 'life_inbox', explicitSave: true } }, source);
      return finish({ text: `Занесла у модуль ${label(type)}: ${item.title}`, item });
    }
  }

  if (starts(lower, ['запиши','збережи','сохрани','запомни','занеси','заметка','нотатка','note','save'])) {
    const item = await createItem(env, user, { type: 'note', title: cleanupTitle(input), content: input, visibility: hasAny(lower, ['сім','сем','shared']) ? 'shared' : 'private', tags: ['note'], metadata: { explicitSave: true } }, source);
    return finish({ text: `Нотатку збережено: ${item.title}`, item });
  }

  const context = await searchItems(env, user, input.split(/\s+/).slice(0, 6).join(' '), 10);
  const ai = await askOpenAI(env, {
    instructions: `Ти приватна сімейна AI-помічниця Соня у системі projectseniorservice. Відповідай коротко, людською українською/російською/суржиком залежно від мови користувача. ${ownerSystemPrompt(user, persona.next)} Якщо треба діяти — дій тільки коли намір явний. Якщо користувач просто питає або роздумує, не зберігай це автоматично. Не вигадуй приватні дані.`,
    input,
    context: context.map(x => ({ type: x.type, title: x.title, content: x.content, dueAt: x.dueAt, tags: x.tags }))
  });
  await logActivity(env, { userId: user.id, source, module: 'ai', action: 'chat', message: input.slice(0,120), metadata: { ok: ai.ok, responseId: ai.rawId } });
  return finish({ text: ai.text || 'Не змогла отримати відповідь від AI.', ai });
}

function starts(s, arr) { return arr.some(x => s.startsWith(x)); }
function hasAny(s, arr) { return arr.some(x => s.includes(x)); }
function cleanupTitle(s) { return String(s).replace(/^(нагадай|напомни|запиши|збережи|сохрани|запомни|занеси|додай|добавь|note|remind|save)\s*/i,'').replace(/\s+/g,' ').trim().slice(0,140) || 'Нова задача'; }
function label(type) { return ({ expense:'витрат', car:'авто', health:'здоров’я', content:'контенту', qa:'QA' })[type] || type; }
