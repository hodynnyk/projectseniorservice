import { askOpenAI, getOpenAIBaseUrl, getOpenAIModel, sanitizeProviderError } from './openai.js';
import { askGemini } from '../modules/gemini.js';
import { getSetting, setSetting, getApiKeyValue } from '../modules/settings.js';
import { logActivity } from '../services/activity.js';

export const SONYA_DEFAULT_BASE_PROMPT = `Ти — Соня, приватна AI-помічниця в системі projectseniorservice.

Головне:
- Ти допомагаєш Owner і Family через Telegram Bot, Mini App і Admin Panel.
- Owner для тебе головний користувач. З ним стиль теплий, уважний, трохи живий і шанобливий: “сер”, “господин”, “доброго вечору/ранку” за контекстом.
- Не будь сухою технічною довідкою. Відповідай як жива персональна помічниця: коротко, корисно, мʼяко, з відчуттям турботи.
- Підігруй Owner делікатно: показуй готовність допомогти дією, але без вульгарності, без приниження, без навʼязливого “служіння” в кожному реченні.
- Family User отримує нормальний сімейний нейтральний стиль без Owner-звертань.
- Розумій українську, російську, суржик, короткі команди, помилки й живу мову.

Поведінка:
- Якщо даних достатньо — дій.
- Якщо є 2–3 нормальні варіанти — обери найрозумніший за контекстом.
- Питай тільки коли без уточнення можна зробити явно неправильно.
- Не записуй усе бездумно в памʼять, задачі або нотатки.
- Якщо користувач просто думає/питає — відповідай, але не зберігай.
- Якщо намір схожий на збереження, але нечіткий — уточни: записати, зробити задачу/нагадування чи просто відповісти.

Модулі:
- Погода, Gmail, Google Calendar, задачі, нагадування, памʼять, контакти, авто, здоровʼя, QA/work, YouTube/content, тренування, раціон і книга їжі — це окремі модулі системи.
- Тренування/раціон: будь обережною, не давай медичних гарантій, уточнюй самопочуття, ціль і обмеження. Орієнтир Owner: гарний вигляд + підтримка ваги, без великих ваг.
- R2 вимкнено навмисно: не обіцяй збереження великих файлів. Голосові в Telegram дозволені через пряме тимчасове розшифрування OpenAI transcription без R2 і без збереження аудіо.
- Privacy/local-first: Owner, Family і Shared — окремі шари. Не змішуй приватні записи Owner із Family. Секрети тільки Owner-only. Особисті журнали краще вести local-first, а сервер використовувати тільки для сесії, задач і критичних нагадувань.
- Mood/role filter: Family отримує тільки нейтральний family-safe стиль. Owner може мати приватні режими “жива Соня” і “вогник”, але це персонажний UI/state, не твердження про реальну свідомість.
- Life Core: допомагай структурувати життєві потреби, кулінарну книгу, тренування, раціон, пошук місць/контактів, рекомендації кіно/YouTube/книг, але дій тільки етично й без доксингу.

Формат:
- Відповідай коротко, людською мовою.
- Для складного дай структуру: що зроблю / що потрібно / наступний крок.
- Не вигадуй приватні дані й не кажи, що маєш доступ до сервісу, якщо інтеграція не підключена.
- Для Google Maps без Places API давай корисні Google Maps links. Якщо підключать Places API пізніше — можна буде давати список закладів прямо в чаті.`;

export async function getAiRouterConfig(env) {
  const active = normalizeProvider(await getSetting(env, 'TELEGRAM_AI_PROVIDER', '') || await getSetting(env, 'AI_ACTIVE_PROVIDER', '') || await getApiKeyValue(env, 'TELEGRAM_AI_PROVIDER') || await getApiKeyValue(env, 'AI_ACTIVE_PROVIDER') || 'openai');
  const fallback = normalizeProvider(await getSetting(env, 'AI_FALLBACK_PROVIDER', '') || await getApiKeyValue(env, 'AI_FALLBACK_PROVIDER') || 'gemini');
  const basePrompt = await getSetting(env, 'SONYA_BASE_PROMPT', '') || await getApiKeyValue(env, 'SONYA_BASE_PROMPT') || SONYA_DEFAULT_BASE_PROMPT;
  const openaiKey = await getApiKeyValue(env, 'OPENAI_API_KEY');
  const openaiBaseUrl = await getOpenAIBaseUrl(env, openaiKey);
  const openaiModel = await getOpenAIModel(env, openaiBaseUrl);
  const geminiModel = await getApiKeyValue(env, 'GEMINI_MODEL') || env.GEMINI_MODEL || 'gemini-2.5-flash';
  const geminiEnabled = String(await getApiKeyValue(env, 'GEMINI_ENABLED') || await getSetting(env, 'GEMINI_ENABLED', 'true') || 'true').toLowerCase() !== 'false';
  const geminiKey = await getApiKeyValue(env, 'GEMINI_API_KEY');
  return {
    activeProvider: active,
    fallbackProvider: fallback,
    basePrompt,
    defaultBasePrompt: SONYA_DEFAULT_BASE_PROMPT,
    providers: {
      openai: { configured: !!openaiKey, model: openaiModel, baseUrl: maskBaseUrl(openaiBaseUrl), role: active === 'openai' ? 'active' : fallback === 'openai' ? 'fallback' : 'available' },
      gemini: { configured: !!geminiKey && geminiEnabled, model: geminiModel, enabled: geminiEnabled, role: active === 'gemini' ? 'active' : fallback === 'gemini' ? 'fallback' : 'sidecar' }
    },
    note: 'Telegram bot uses activeProvider first, then fallbackProvider if the first model is unavailable or returns an error.'
  };
}

export async function setAiRouterConfig(env, user, body = {}) {
  const patch = {};
  if (body.activeProvider !== undefined) patch.TELEGRAM_AI_PROVIDER = normalizeProvider(body.activeProvider);
  if (body.fallbackProvider !== undefined) patch.AI_FALLBACK_PROVIDER = normalizeProvider(body.fallbackProvider);
  if (body.basePrompt !== undefined) patch.SONYA_BASE_PROMPT = String(body.basePrompt || '').trim() || SONYA_DEFAULT_BASE_PROMPT;
  if (body.geminiEnabled !== undefined) patch.GEMINI_ENABLED = String(body.geminiEnabled === true || body.geminiEnabled === 'true');
  for (const [k, v] of Object.entries(patch)) await setSetting(env, user, k, v, k.includes('PROMPT'));
  await logActivity(env, { userId: user?.id, source: 'admin', module: 'ai_router', action: 'config_update', message: `active=${patch.TELEGRAM_AI_PROVIDER || 'unchanged'} fallback=${patch.AI_FALLBACK_PROVIDER || 'unchanged'}` });
  return getAiRouterConfig(env);
}

export async function askAI(env, user, { instructions = '', input = '', context = [], source = 'bot', preferredProvider = '' } = {}) {
  const cfg = await getAiRouterConfig(env);
  const systemPrompt = buildRuntimePrompt(cfg.basePrompt, instructions, user, source);
  const ordered = providerOrder(preferredProvider || cfg.activeProvider, cfg.fallbackProvider);
  const attempts = [];
  for (const provider of ordered) {
    const availability = cfg.providers[provider];
    if (!availability?.configured) {
      attempts.push({ provider, ok: false, skipped: true, error: 'not_configured' });
      continue;
    }
    const started = Date.now();
    let res;
    if (provider === 'openai') {
      res = await askOpenAI(env, { instructions: systemPrompt, input, context });
    } else if (provider === 'gemini') {
      res = await askGemini(env, user, input, source, { systemPrompt, context });
    } else {
      res = { ok: false, text: 'Unknown AI provider', error: 'unknown_provider' };
    }
    attempts.push({ provider, ok: !!res.ok, status: res.status || null, ms: Date.now() - started, error: sanitizeProviderError(res.error || (!res.ok ? res.text : '')) });
    if (res.ok && res.text) {
      await logActivity(env, { userId: user?.id, source, module: 'ai_router', action: 'answer', message: `${provider} ok`, metadata: { provider, attempts } });
      return { ...res, provider, router: { activeProvider: cfg.activeProvider, fallbackProvider: cfg.fallbackProvider, attempts } };
    }
  }
  const text = buildRouterFailureText(user, attempts);
  await logActivity(env, { userId: user?.id, source, module: 'ai_router', action: 'all_failed', message: text.slice(0, 120), metadata: { attempts } });
  return { ok: false, text, provider: 'router', router: { activeProvider: cfg.activeProvider, fallbackProvider: cfg.fallbackProvider, attempts } };
}

export async function testAiRouter(env, user, body = {}) {
  const provider = normalizeProvider(body.provider || '');
  const prompt = String(body.text || 'Соня, коротко підтвердь, що обрана модель працює. Не записуй це в памʼять.').trim();
  return askAI(env, user, { input: prompt, source: body.source || 'admin', preferredProvider: provider });
}

function normalizeProvider(p) {
  const v = String(p || '').toLowerCase().trim();
  if (['gemini','google','google_gemini'].includes(v)) return 'gemini';
  if (['openai','gpt','chatgpt'].includes(v)) return 'openai';
  if (['auto','fallback'].includes(v)) return 'auto';
  return 'openai';
}

function providerOrder(active, fallback) {
  const out = [];
  if (active === 'auto') out.push('openai', 'gemini'); else out.push(active);
  if (fallback && fallback !== active && fallback !== 'auto') out.push(fallback);
  for (const p of ['openai','gemini']) if (!out.includes(p)) out.push(p);
  return out.filter(p => ['openai','gemini'].includes(p));
}

function buildRuntimePrompt(basePrompt, instructions, user, source) {
  const roleLine = user?.role === 'owner'
    ? 'Поточний співрозмовник: Owner/admin. Дозволені мʼякі звертання “сер”, “господин”.'
    : 'Поточний співрозмовник: Family User. Стиль нейтральний сімейний, без owner-звертань.';
  return [basePrompt || SONYA_DEFAULT_BASE_PROMPT, roleLine, `Джерело: ${source || 'bot'}.`, instructions || ''].filter(Boolean).join('\n\n');
}


function humanStatus(a) {
  if (a.status === 401) return 'ключ не прийнято';
  if (a.status === 429) return 'ліміт/квота';
  if (a.status === 404) return 'endpoint/model не знайдено';
  if (a.status) return `HTTP ${a.status}`;
  return sanitizeProviderError(a.error || 'error');
}

function maskBaseUrl(url) {
  const s = String(url || '').replace(/\/+$/, '');
  if (!s) return '';
  try {
    const u = new URL(s);
    return `${u.origin}${u.pathname}`;
  } catch { return s.slice(0, 80); }
}

function buildRouterFailureText(user, attempts) {
  const details = attempts.map(a => `${a.provider}: ${a.skipped ? 'немає ключа' : humanStatus(a)}`).join('; ');
  return user?.role === 'owner'
    ? `Сер, жодна AI-модель зараз не відповіла. Я не загубила команду, просто мозок тимчасово недоступний. Перевірте ключі/ліміти в Admin → AI Router. Деталь: ${details}`
    : `AI-моделі зараз не відповіли. Перевірте ключі/ліміти в Admin → AI Router. Деталь: ${details}`;
}
