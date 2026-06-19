import { getApiKeyValue } from '../modules/settings.js';

const DEFAULT_TEXT_MODEL = 'gpt-5.4';
const SAFE_TEXT_FALLBACKS = ['gpt-5.4', 'gpt-4o-mini', 'gpt-4.1-mini'];
const DEFAULT_IMAGE_MODEL = 'gpt-image-1';

export async function askOpenAI(env, { instructions, input, context = [] } = {}) {
  const apiKey = await getApiKeyValue(env, 'OPENAI_API_KEY');
  if (!apiKey) {
    return { ok: false, text: fallbackAnswer(input), missingKey: true, error: 'OPENAI_API_KEY_missing' };
  }

  const rawModel = (await getApiKeyValue(env, 'OPENAI_MODEL')) || env.OPENAI_MODEL || DEFAULT_TEXT_MODEL;
  const normalized = normalizeTextModel(rawModel);
  const modelCandidates = unique([
    normalized.model,
    ...SAFE_TEXT_FALLBACKS
  ]).filter(m => !isImageModel(m));

  const prompt = buildUserPayload(input, context);
  const attempts = [];
  if (normalized.warning) attempts.push({ endpoint: 'model_normalizer', model: rawModel, ok: false, status: 0, error: normalized.warning, using: normalized.model });

  for (const model of modelCandidates) {
    const res = await tryResponsesApi(apiKey, model, instructions, prompt);
    attempts.push(res.attempt);
    if (res.ok) return { ok: true, text: res.text, rawId: res.rawId, status: res.status, model, endpoint: 'responses', attempts, modelWarning: normalized.warning || '' };

    if (isHardAuthOrBilling(res)) {
      return {
        ok: false,
        text: humanOpenAIError(res, model),
        error: res.error,
        status: res.status,
        model,
        endpoint: 'responses',
        attempts
      };
    }

    const chat = await tryChatCompletionsApi(apiKey, model, instructions, prompt);
    attempts.push(chat.attempt);
    if (chat.ok) return { ok: true, text: chat.text, rawId: chat.rawId, status: chat.status, model, endpoint: 'chat_completions', attempts, modelWarning: normalized.warning || '' };

    if (isHardAuthOrBilling(chat)) {
      return {
        ok: false,
        text: humanOpenAIError(chat, model),
        error: chat.error,
        status: chat.status,
        model,
        endpoint: 'chat_completions',
        attempts
      };
    }
  }

  const last = attempts[attempts.length - 1] || {};
  return {
    ok: false,
    text: humanOpenAIError(last, normalized.model || rawModel),
    error: last.error || 'openai_all_attempts_failed',
    status: last.status || 0,
    model: normalized.model || rawModel,
    attempts
  };
}

export async function diagnoseOpenAI(env) {
  const apiKey = await getApiKeyValue(env, 'OPENAI_API_KEY');
  const rawTextModel = (await getApiKeyValue(env, 'OPENAI_MODEL')) || env.OPENAI_MODEL || DEFAULT_TEXT_MODEL;
  const textModel = normalizeTextModel(rawTextModel);
  const rawImageModel = (await getApiKeyValue(env, 'OPENAI_IMAGE_MODEL')) || env.OPENAI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;
  const imageModel = normalizeImageModel(rawImageModel);
  if (!apiKey) return { ok: false, configured: false, rawTextModel, effectiveTextModel: textModel.model, imageModel, error: 'OPENAI_API_KEY is missing' };

  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { authorization: `Bearer ${apiKey}` }
  });
  const data = await res.json().catch(() => ({}));
  const models = Array.isArray(data.data) ? data.data.map(x => x.id).filter(Boolean) : [];
  const modelAvailable = models.includes(textModel.model);
  const imageModelAvailable = models.includes(imageModel);
  return {
    ok: res.ok,
    configured: true,
    status: res.status,
    rawTextModel,
    effectiveTextModel: textModel.model,
    textModelWarning: textModel.warning || '',
    textModelAvailable: modelAvailable,
    imageModel,
    imageModelAvailable,
    chatAndImageSeparated: !isImageModel(textModel.model),
    suggestedTextModels: SAFE_TEXT_FALLBACKS.filter(x => models.includes(x)),
    accountVisibleModelsSample: models.slice(0, 30),
    error: data.error?.message || data.error || ''
  };
}

export async function transcribeAudio(env, blob, filename = 'voice.ogg') {
  const apiKey = await getApiKeyValue(env, 'OPENAI_API_KEY');
  if (!apiKey) return { ok: false, text: '', error: 'OPENAI_API_KEY is missing' };
  const model = await getApiKeyValue(env, 'OPENAI_TRANSCRIBE_MODEL') || env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1';
  const fd = new FormData();
  fd.set('model', model);
  fd.set('file', blob, filename);
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { authorization: `Bearer ${apiKey}` }, body: fd });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, text: data.text || '', data, status: res.status, error: data.error?.message || data.error || '' };
}

async function tryResponsesApi(apiKey, model, instructions, prompt) {
  const body = {
    model,
    store: false,
    instructions: instructions || 'You are Sonia, a private family assistant. Be concise and useful.',
    input: prompt
  };
  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    const text = extractResponsesText(data);
    return {
      ok: res.ok && !!text,
      text,
      rawId: data.id || null,
      status: res.status,
      error: data.error?.message || data.error || (!text ? 'empty_response_text' : ''),
      attempt: { endpoint: 'responses', model, ok: res.ok && !!text, status: res.status, error: data.error?.message || data.error || (!text ? 'empty_response_text' : '') }
    };
  } catch (err) {
    return { ok: false, text: '', status: 0, error: err.message, attempt: { endpoint: 'responses', model, ok: false, status: 0, error: err.message } };
  }
}

async function tryChatCompletionsApi(apiKey, model, instructions, prompt) {
  const body = {
    model,
    messages: [
      { role: 'system', content: instructions || 'You are Sonia, a private family assistant. Be concise and useful.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.4
  };
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    const text = data.choices?.[0]?.message?.content?.trim() || data.error?.message || '';
    return {
      ok: res.ok && !!text && !data.error,
      text,
      rawId: data.id || null,
      status: res.status,
      error: data.error?.message || data.error || (!text ? 'empty_chat_text' : ''),
      attempt: { endpoint: 'chat_completions', model, ok: res.ok && !!text && !data.error, status: res.status, error: data.error?.message || data.error || (!text ? 'empty_chat_text' : '') }
    };
  } catch (err) {
    return { ok: false, text: '', status: 0, error: err.message, attempt: { endpoint: 'chat_completions', model, ok: false, status: 0, error: err.message } };
  }
}

function normalizeTextModel(value) {
  const raw = String(value || '').trim();
  const clean = raw.toLowerCase().replace(/\s+/g, '-').replace(/[–—_]+/g, '-');
  if (!raw) return { model: DEFAULT_TEXT_MODEL };
  if (isImageModel(clean)) {
    return {
      model: DEFAULT_TEXT_MODEL,
      warning: `OPENAI_MODEL мав image-модель "${raw}". Для чату використовую ${DEFAULT_TEXT_MODEL}. Image-модель тримайте в OPENAI_IMAGE_MODEL.`
    };
  }
  if (clean === 'gpt-5-4' || clean === 'gpt5-4' || clean === 'gpt-54' || clean === 'gpt54') return { model: 'gpt-5.4' };
  if (clean === 'gpt-5.4') return { model: 'gpt-5.4' };
  return { model: raw };
}

function normalizeImageModel(value) {
  const raw = String(value || '').trim();
  const clean = raw.toLowerCase().replace(/\s+/g, '-').replace(/[–—_]+/g, '-');
  if (!raw) return DEFAULT_IMAGE_MODEL;
  if (['gpt-image','gpt-image-model','gpt-imadje','gpt-img','image','gpt-картинка'].includes(clean)) return DEFAULT_IMAGE_MODEL;
  return raw;
}

function isImageModel(value) {
  const s = String(value || '').toLowerCase();
  return s.includes('image') || s.includes('imadje') || s.includes('img') || s.includes('картин');
}

function buildUserPayload(input, context) {
  return JSON.stringify({ input, privateContext: context }, null, 2);
}

function extractResponsesText(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const chunks = [];
  for (const out of data.output || []) {
    for (const c of out.content || []) {
      if (typeof c.text === 'string') chunks.push(c.text);
      if (typeof c.output_text === 'string') chunks.push(c.output_text);
    }
  }
  return chunks.join('\n').trim();
}

function isHardAuthOrBilling(res) {
  const s = String(res.error || '').toLowerCase();
  return [401, 403, 429].includes(Number(res.status)) ||
    s.includes('incorrect api key') ||
    s.includes('invalid api key') ||
    s.includes('billing') ||
    s.includes('quota') ||
    s.includes('insufficient_quota') ||
    s.includes('rate limit');
}

function humanOpenAIError(res, model) {
  const msg = String(res.error || '').trim();
  const low = msg.toLowerCase();
  if (Number(res.status) === 401 || low.includes('incorrect api key') || low.includes('invalid api key')) {
    return 'OpenAI не відповів: ключ OPENAI_API_KEY неправильний або не з цього API-проєкту. Перевірте ключ у Admin → API Keys.';
  }
  if (low.includes('insufficient_quota') || low.includes('quota') || low.includes('billing')) {
    return 'OpenAI не відповів: на API-проєкті немає доступного білінгу/квоти. Кредити в ChatGPT не завжди дорівнюють API-балансу. Перевірте Platform → Billing/Usage.';
  }
  if (Number(res.status) === 429 || low.includes('rate limit')) {
    return 'OpenAI не відповів: rate limit або тимчасове обмеження. Спробуйте ще раз або поставте Gemini як fallback.';
  }
  if (low.includes('model') && (low.includes('not found') || low.includes('does not exist') || low.includes('unsupported'))) {
    return `OpenAI не відповів: модель ${model} недоступна для цього API-ключа. У Admin → Integrations → OpenAI diagnostics перевірте доступні моделі.`;
  }
  if (msg) return `OpenAI не відповів: ${msg}`;
  return 'OpenAI не відповів: невідома помилка API. Перевірте Admin → AI Router → Test OpenAI.';
}

function unique(arr) { return [...new Set(arr.filter(Boolean).map(x => String(x).trim()).filter(Boolean))]; }

function fallbackAnswer(input) {
  return `AI-ключ ще не доданий. Я збережу команди, задачі, нотатки й пошук локально, а GPT-відповіді ввімкнуться після додавання OPENAI_API_KEY в Admin > API Keys. Текст: ${String(input || '').slice(0, 160)}`;
}
