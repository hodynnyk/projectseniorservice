import { createItem, searchItems, listItems } from '../modules/items.js';
import { getConversationContext, appendConversationTurn, clearConversationContext } from '../modules/conversation.js';
import { askAI } from './router.js';
import { parseLooseDueAt, formatShort } from '../utils/dates.js';
import { logActivity } from '../services/activity.js';
import { isWeatherIntent, getWeatherForText } from '../modules/weather.js';
import { listGmailMessages, sendGmailMessage, listCalendarEvents, createCalendarEvent } from '../modules/google.js';
import { getSetting } from '../modules/settings.js';
import { askGemini } from '../modules/gemini.js';
import { beforeAssistantReply, styleReply, ownerSystemPrompt, wantsSaveExplicitly, needsClarificationBeforeSave } from './personality.js';

export async function handleNaturalInput(env, user, text, source = 'bot') {
  const input = String(text || '').trim();
  const persona = user ? await beforeAssistantReply(env, user, source) : { inactive: false, next: {} };
  const finish = (payload) => ({ ...payload, text: styleReply(user, payload.text, { inactive: persona.inactive, source }) });

  if (!input) return finish({ text: user?.role === 'owner' ? 'Я поруч, сер. Напишіть команду або киньте думку — я акуратно розберу.' : 'Я поруч. Напиши команду або кинь задачу.' });
  const lower = input.toLowerCase();
  const explicitSave = wantsSaveExplicitly(lower);

  if (hasAny(lower, ['очисти контекст','забудь цей діалог','сбрось контекст','clear context'])) {
    await clearConversationContext(env, user, source);
    return finish({ text: user?.role === 'owner' ? 'Контекст цього діалогу очищено, сер.' : 'Контекст діалогу очищено.' });
  }

  if (isMapsIntent(lower)) {
    return finish(await handleMapsNatural(env, user, input, lower, source));
  }

  if (isWeatherIntent(input)) {
    const result = await getWeatherForText(env, user, input, source);
    return finish(result);
  }

  if (isGeminiIntent(lower)) {
    const prompt = input.replace(/^(спитай|спроси|ask)?\s*(gemini|геміні|джеміні)[:,\s-]*/i, '').trim() || input;
    const result = await askGemini(env, user, prompt, source);
    return finish({ text: result.ok ? `Gemini sidecar:
${result.text}` : result.text, ai: result });
  }

  if (isGmailIntent(lower)) {
    const result = await handleGmailNatural(env, user, input, lower, source);
    return finish(result);
  }

  if (isCalendarIntent(lower)) {
    const result = await handleCalendarNatural(env, user, input, lower, source);
    return finish(result);
  }

  if (isTodayOverviewIntent(lower)) {
    const active = (await listItems(env, user, { limit: 50 })).filter(x => x.status !== 'done').slice(0, 12);
    return finish({ text: active.length ? `Активне:\n${active.map((x,i)=>`${i+1}. ${x.title}${x.dueAt ? ' — '+formatShort(x.dueAt) : ''}`).join('\n')}` : 'Активних задач поки немає.' });
  }

  if (isMemorySearchIntent(lower)) {
    const q = input.replace(/^(знайди|найди|search|пошукай)\s*/i, '').replace(/(у|в)\s+(памʼяті|пам'яті|памяті|замітках|нотатках|задачах|записах)/gi, '').trim();
    const results = await searchItems(env, user, q || input, 12);
    return finish({ text: results.length ? `Знайшла в памʼяті:\n${results.map((x,i)=>`${i+1}. [${x.type}] ${x.title}`).join('\n')}` : 'У своїй памʼяті нічого такого не знайшла.' });
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

  if (isWorkoutIntent(lower)) {
    return finish(await handleWorkoutNatural(env, user, input, lower, explicitSave, source));
  }

  if (isNutritionIntent(lower)) {
    return finish(await handleNutritionNatural(env, user, input, lower, explicitSave, source));
  }

  if (isFoodBookIntent(lower)) {
    return finish(await handleFoodBookNatural(env, user, input, lower, explicitSave, source));
  }

  const typeRules = [
    ['expense', ['витрат','расход','потрат','грн','uah','₴']],
    ['car', ['авто','машин','kia','сефія','sephia','патруб','антифриз','ремонт']],
    ['health', ['здоров','ліки','лекар','бол','температур','симптом']],
    ['workout', ['тренування','тренировка','упражнен','план трен','жим','присед','планка']],
    ['nutrition', ['раціон','рацион','харч','питани','калор','білок','белок','жири','углевод','вуглевод']],
    ['food_book', ['книга їжі','книга еды','рецепт','страва','блюдо','food book']],
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

  const memoryContext = await searchItems(env, user, input.split(/\s+/).slice(0, 6).join(' '), 10);
  const dialogContext = await getConversationContext(env, user, source);
  await appendConversationTurn(env, user, source, 'user', input, { kind: 'message' });
  const ai = await askAI(env, user, {
    instructions: `Ти приватна сімейна AI-помічниця Соня у системі projectseniorservice. Відповідай коротко, людською українською/російською/суржиком залежно від мови користувача. ${ownerSystemPrompt(user, persona.next)} Ти маєш короткий rolling-контекст поточного діалогу: використовуй його, щоб не відповідати деревʼяно і не плутати пошук місць із пошуком задач. Якщо треба діяти — дій тільки коли намір явний. Якщо користувач просто питає або роздумує, не зберігай це автоматично як задачу. Не вигадуй приватні дані. Для тренувань і раціону поводься як обережна персональна помічниця: уточнюй самопочуття, не давай медичних гарантій, не зберігай їжу/тренування без явного наміру.`,
    input,
    context: [
      ...dialogContext.map(x => ({ type: 'dialog', role: x.role, content: x.text, at: x.at })),
      ...memoryContext.map(x => ({ type: x.type, title: x.title, content: x.content, dueAt: x.dueAt, tags: x.tags }))
    ],
    source
  });
  const textOut = ai.text || 'Не змогла отримати відповідь від AI.';
  await appendConversationTurn(env, user, source, 'assistant', textOut, { provider: ai.provider || '' });
  await logActivity(env, { userId: user.id, source, module: 'ai', action: 'chat', message: input.slice(0,120), metadata: { ok: ai.ok, provider: ai.provider, responseId: ai.rawId, router: ai.router, dialogTurns: dialogContext.length } });
  return finish({ text: textOut, ai });
}


function isTodayOverviewIntent(lower) {
  const s = String(lower || '').trim();
  return /^(що сьогодні|что сегодня|today|план дня|мій день|мой день)\??$/.test(s)
    || /^(покажи|дай|відкрий|открой)\s+(план|задачі|задачи)\s+(на\s+)?сьогодні/.test(s);
}

function isMemorySearchIntent(lower) {
  const s = String(lower || '');
  if (!starts(s, ['знайди','найди','search','пошукай'])) return false;
  return hasAny(s, ['в пам', 'у пам', 'памʼят', "пам'ят", 'памят', 'нотат', 'замет', 'запис', 'задач']);
}

function isMapsIntent(lower) {
  const s = String(lower || '');
  const placeWords = ['де поїсти','де поесть','по вечер','повечер','вечерят','пообідати','пообедать','кафе','ресторан','суші','суши','піца','пицц','аптека','магазин','заправка','сто ','шиномонтаж','барбер','перукар','google maps','гугл карт','карти','карта','маршрут','поруч','рядом','near me'];
  if (placeWords.some(k => s.includes(k))) return true;
  return /^(знайди|найди|пошукай|search)\s+(де|куди|кафе|ресторан|аптек|магазин|заправ)/.test(s);
}

async function handleMapsNatural(env, user, input, lower, source) {
  const baseLocation = await getSetting(env, 'DEFAULT_MAPS_LOCATION', '') || await getSetting(env, 'DEFAULT_WEATHER_LOCATION', '') || env.DEFAULT_MAPS_LOCATION || 'Обухів, Київська область';
  const clean = String(input || '').replace(/^(знайди|найди|пошукай|search)\s*/i, '').replace(/\b(сьогодні|сегодня|мені|мне|будь ласка|пожалуйста)\b/gi, '').replace(/\s+/g, ' ').trim();
  let query = clean || input;
  if (!hasKnownLocation(lower)) query = `${query} ${baseLocation}`;
  const mapsSearch = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  const mapsFood = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('restaurants cafes ' + (hasKnownLocation(lower) ? clean : baseLocation))}`;
  await logActivity(env, { userId: user.id, source, module: 'maps', action: 'maps_link', message: query, metadata: { mapsSearch } });
  const prefix = user?.role === 'owner' ? 'Сер, це вже не шукаю серед задач — відкриваю як запит до Google Maps.' : 'Шукаю це як місце на Google Maps.';
  return {
    text: `${prefix}\n\nОсновний пошук:\n${mapsSearch}\n\nЯкщо хочете саме вечерю/кафе поруч:\n${mapsFood}\n\nПізніше можу підключити Google Places API, щоб давати вже список закладів прямо в чаті.`
  };
}

function hasKnownLocation(lower) {
  return hasAny(lower, ['київ','киев','обухів','обухов','українк','украинка','васильків','васильков','бровар','ірпін','ирпень','львів','львов','одес','харків','харьков']);
}

function starts(s, arr) { return arr.some(x => s.startsWith(x)); }
function hasAny(s, arr) { return arr.some(x => s.includes(x)); }
function cleanupTitle(s) { return String(s).replace(/^(нагадай|напомни|запиши|збережи|сохрани|запомни|занеси|додай|добавь|note|remind|save)\s*/i,'').replace(/\s+/g,' ').trim().slice(0,140) || 'Нова задача'; }
function label(type) { return ({ expense:'витрат', car:'авто', health:'здоров’я', workout:'тренувань', nutrition:'харчування', food_book:'книги їжі', content:'контенту', qa:'QA' })[type] || type; }



function isWorkoutIntent(s) { return /тренув|тренир|workout|fitness|планка|віджим|отжим|присед|тяга|гантел|бутл|крепатур|зал|форма тіла|гарний вигляд|схуд|набрати/.test(s); }
function isNutritionIntent(s) { return /раціон|рацион|харч|питан|калор|білок|белок|жири|вуглевод|углевод|що їсти|что есть|снідан|завтрак|обід|ужин|вечеря|перекус|креатин|омега|вітамін/.test(s); }
function isFoodBookIntent(s) { return /книга їжі|книга еды|food book|рецепт|страва|блюдо|меню|їжа|еда|продукт|курка|греч|рис|яйц|салат|суп/.test(s) && /додай|добавь|збережи|сохрани|створи|создай|книга|рецепт|страва|блюдо/.test(s); }

async function handleWorkoutNatural(env, user, input, lower, explicitSave, source) {
  const wantsPlan = /план|програм|склади|составь|створи|создай|тренування|тренировка/.test(lower);
  if (!explicitSave && !wantsPlan) {
    return { text: user.role === 'owner'
      ? 'Сер, я бачу тему тренування. Можу просто порадити, створити тренування на сьогодні або занести це у ваш fitness-журнал. Як бажаєте?'
      : 'Бачу тему тренування. Створити запис чи просто порадити?' };
  }
  const title = cleanupTitle(input).replace(/^тренування\s*/i, '') || 'Тренування';
  const item = await createItem(env, user, {
    type: 'workout',
    title: wantsPlan ? `План тренування: ${title}`.slice(0, 150) : title,
    content: buildWorkoutContent(input, lower),
    visibility: 'private',
    priority: /сьогодні|today|зараз|сейчас/.test(lower) ? 'high' : 'normal',
    tags: ['fitness','workout','owner-body-plan'],
    metadata: { goal: 'гарний вигляд + підтримка ваги', explicitSave: explicitSave || wantsPlan, caution: 'без великих ваг; не медична порада' }
  }, source);
  return { text: `Готово, сер. Я створила fitness-запис: ${item.title}
Я триматиму це окремо від бездумних нотаток: тільки тренування, прогрес і відчуття.`, item };
}

function buildWorkoutContent(input, lower) {
  if (/план|програм|склади|составь|створи|создай/.test(lower)) {
    return `Запит: ${input}

Чернетка логіки Соні:
1) Розминка 5–7 хвилин: плечі, шия, таз, коліна, легка мобільність.
2) Основний блок без великих ваг: віджимання/тяга бутлем/планка/бокова планка/легкі присідання.
3) Обсяг підбирати по самопочуттю, без болю в суглобах і різкого перенавантаження.
4) Після тренування: вода, білкова їжа, короткий запис “що болить/що легко”.

Соня не збільшує навантаження автоматично — спершу питає самопочуття.`;
  }
  return input;
}

async function handleNutritionNatural(env, user, input, lower, explicitSave, source) {
  const wantsPlan = /раціон|рацион|меню|план|склади|составь|на день|на тижд|на неделю/.test(lower);
  if (!explicitSave && !wantsPlan) {
    return { text: user.role === 'owner'
      ? 'Сер, я бачу тему харчування. Можу порадити по раціону, створити план дня або занести прийом їжі. Без вашого дозволу в журнал не пишу.'
      : 'Бачу тему харчування. Порадити, створити план чи записати прийом їжі?' };
  }
  const item = await createItem(env, user, {
    type: 'nutrition',
    title: wantsPlan ? 'Раціон / план харчування' : cleanupTitle(input),
    content: buildNutritionContent(input, lower),
    visibility: 'private',
    tags: ['nutrition','ration','food'],
    metadata: { goal: 'тримати вагу і вигляд', explicitSave: explicitSave || wantsPlan, style: 'без фанатизму, практично' }
  }, source);
  return { text: `Занесла у модуль харчування, сер: ${item.title}
Я буду вести це як раціон, а не як хаотичні нотатки.`, item };
}

function buildNutritionContent(input, lower) {
  if (/раціон|рацион|меню|план|склади|составь/.test(lower)) {
    return `Запит: ${input}

Чернетка Соні:
— База: білок у кожний основний прийом їжі.
— Вуглеводи: рис/гречка/картопля/овес під активність.
— Жири: яйця/риба/олія/горіхи помірно.
— Овочі/фрукти щодня.
— Не урізати різко калорії, якщо ціль — гарний вигляд і стабільна вага.
— Уточнювати апетит, сон, тренування і вагу перед змінами.`;
  }
  return input;
}

async function handleFoodBookNatural(env, user, input, lower, explicitSave, source) {
  if (!explicitSave && !/додай|добавь|збережи|сохрани|створи|создай/.test(lower)) {
    return { text: 'Сер, це схоже на ідею для книги їжі. Додати як страву/рецепт чи просто обговорюємо?' };
  }
  const mealType = /снідан|завтрак/.test(lower) ? 'breakfast' : /обід|обед/.test(lower) ? 'lunch' : /вечер|ужин/.test(lower) ? 'dinner' : /перекус/.test(lower) ? 'snack' : 'meal';
  const item = await createItem(env, user, {
    type: 'food_book',
    title: cleanupTitle(input).replace(/^(рецепт|страва|блюдо)\s*/i,'') || 'Страва для книги їжі',
    content: input,
    visibility: /сім|сем|shared|друж|wife|жена/.test(lower) ? 'shared' : 'private',
    tags: ['food_book', mealType],
    metadata: { mealType, explicitSave: true, status: 'draft_recipe', sonyaNote: 'порадитися перед включенням у раціон' }
  }, source);
  return { text: `Додала в книгу їжі, сер: ${item.title}
Я позначила як ${mealType}. Потім зможемо відсортувати по сніданках, обідах, вечері й перекусах.`, item };
}

function isGeminiIntent(s) { return /\b(gemini|геміні|джеміні)\b/i.test(s); }
function isGmailIntent(s) { return /gmail|google mail|гугл пош|гугл почт|джимейл|джімейл|листи gmail|письма gmail|email через google|відправ.*лист|отправ.*письм/.test(s); }
function isCalendarIntent(s) { return /google calendar|гугл календар|календар|календарі|календаре|calendar/.test(s); }

async function handleGmailNatural(env, user, input, lower, source) {
  try {
    if (/відправ|отправ|send/.test(lower)) {
      const to = input.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
      if (!to) return { text: 'Сер, для відправки через Gmail потрібен email отримувача. Наприклад: “відправ лист на name@gmail.com тема: ... текст: ...”.' };
      const subject = (input.match(/(?:тема|subject)\s*[:\-]\s*([^\n]+?)(?:\s+(?:текст|body|message)\s*[:\-]|$)/i)?.[1] || 'Повідомлення від Соні').trim();
      const body = (input.match(/(?:текст|body|message)\s*[:\-]\s*([\s\S]+)$/i)?.[1] || input.replace(to, '').replace(/відправ|отправ|send|лист|письмо|email/gi, '')).trim();
      if (!body || body.length < 3) return { text: 'Сер, я бачу отримувача, але не бачу текст листа. Дайте текст після “текст:”.' };
      const sent = await sendGmailMessage(env, user, { to, subject, text: body, fromName: 'Соня' });
      return { text: sent.ok ? `Лист через Gmail відправлено: ${to}\nТема: ${subject}` : `Gmail не відправив лист: ${sent.error || sent.status}` };
    }
    const q = /важлив|important/.test(lower) ? 'is:important newer_than:30d' : /непроч|unread|нов/.test(lower) ? 'is:unread newer_than:30d' : 'newer_than:14d';
    const data = await listGmailMessages(env, user, { q, limit: 8 });
    if (!data.ok) return { text: `Gmail ще не готовий: ${data.error}` };
    return { text: data.messages.length ? `Останні Gmail листи:\n${data.messages.map((m,i)=>`${i+1}. ${m.subject}\n   Від: ${m.from}\n   ${m.snippet}`).join('\n')}` : 'У Gmail за цим фільтром нічого не знайшла.' };
  } catch (err) {
    return { text: `Gmail модуль потребує підключення Google OAuth. Відкрийте Admin або Mini App → Google → Connect Google. Деталь: ${err.message || err}` };
  }
}

async function handleCalendarNatural(env, user, input, lower, source) {
  try {
    if (/створи|создай|додай|добавь|заплануй|schedule|create/.test(lower)) {
      const due = parseLooseDueAt(input, env.DEFAULT_TIMEZONE || 'Europe/Kyiv');
      if (!due.dueAt) return { text: 'Сер, я створю подію, але потрібен час. Наприклад: “додай у календар завтра о 19:00 купити ліки”.' };
      const startDate = new Date(due.dueAt);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      const title = cleanupTitle(input).replace(/^(у календар|в календар|google calendar|гугл календар)\s*/i, '').slice(0, 120) || 'Подія';
      const created = await createCalendarEvent(env, user, { summary: title, start: startDate.toISOString(), end: endDate.toISOString(), timezone: due.timezone || 'Europe/Kyiv', description: input });
      return { text: created.ok ? `Подію додано в Google Calendar: ${created.event.summary}\nКоли: ${formatShort(created.event.start)}` : `Calendar не створив подію: ${created.error}` };
    }
    const range = /завтра|tomorrow/.test(lower) ? 'tomorrow' : /тиж|недел|week/.test(lower) ? 'week' : 'today';
    const data = await listCalendarEvents(env, user, { range, limit: 12 });
    if (!data.ok) return { text: `Google Calendar ще не готовий: ${data.error}` };
    return { text: data.events.length ? `Google Calendar (${range}):\n${data.events.map((e,i)=>`${i+1}. ${e.summary}\n   ${formatShort(e.start)}${e.location ? ' · '+e.location : ''}`).join('\n')}` : `У Google Calendar на ${range} подій не знайшла.` };
  } catch (err) {
    return { text: `Calendar модуль потребує підключення Google OAuth. Відкрийте Admin або Mini App → Google → Connect Google. Деталь: ${err.message || err}` };
  }
}
