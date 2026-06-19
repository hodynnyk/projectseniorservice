import { getApiKeyValue } from '../modules/settings.js';

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const SECUREAPI_BASE_URL = 'https://3xanny-secureapi.hf.space/v1';

export async function askOpenAI(env, { instructions, input, context = [] } = {}) {
  const apiKey = clean(await getApiKeyValue(env, 'OPENAI_API_KEY'));
  if (!apiKey) return { ok: false, text: fallbackAnswer(input), missingKey: true, error: 'OPENAI_API_KEY missing' };

  const baseUrl = await getOpenAIBaseUrl(env, apiKey);
  const model = await getOpenAIModel(env, baseUrl);
  const useChatFirst = String(await getApiKeyValue(env, 'OPENAI_COMPAT_MODE') || env.OPENAI_COMPAT_MODE || '').toLowerCase().includes('chat');

  try {
    const first = useChatFirst
      ? await callChatCompletions(baseUrl, apiKey, model, instructions, input, context)
      : await callResponses(baseUrl, apiKey, model, instructions, input, context);
    if (first.ok || !shouldFallbackToChat(first)) return first;

    const second = useChatFirst
      ? await callResponses(baseUrl, apiKey, model, instructions, input, context)
      : await callChatCompletions(baseUrl, apiKey, model, instructions, input, context);
    return second.ok ? second : { ...second, fallbackFrom: first.status || first.error || 'responses_failed' };
  } catch (err) {
    return { ok: false, text: `AI тимчасово недоступний: ${err.message}`, error: sanitizeProviderError(err.message) };
  }
}

async function callResponses(baseUrl, apiKey, model, instructions, input, context) {
  const body = {
    model,
    store: false,
    input: [
      { role: 'system', content: instructions || 'You are Sonia, a private family assistant. Be concise and useful.' },
      { role: 'user', content: JSON.stringify({ input, privateContext: context }, null, 2) }
    ]
  };
  const res = await fetch(`${baseUrl}/responses`, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await safeJson(res);
  const text = extractResponsesText(data) || sanitizeProviderError(data.error?.message || data.error || '');
  return { ok: res.ok, text, rawId: data.id || null, status: res.status, model, endpoint: `${baseUrl}/responses`, error: res.ok ? '' : sanitizeProviderError(data.error?.message || data.error || text) };
}

async function callChatCompletions(baseUrl, apiKey, model, instructions, input, context) {
  const body = {
    model,
    messages: [
      { role: 'system', content: instructions || 'You are Sonia, a private family assistant. Be concise and useful.' },
      { role: 'user', content: JSON.stringify({ input, privateContext: context }, null, 2) }
    ]
  };
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await safeJson(res);
  const text = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || sanitizeProviderError(data.error?.message || data.error || '');
  return { ok: res.ok, text, rawId: data.id || null, status: res.status, model, endpoint: `${baseUrl}/chat/completions`, error: res.ok ? '' : sanitizeProviderError(data.error?.message || data.error || text) };
}

export async function transcribeAudio(env, blob, filename = 'voice.ogg') {
  const apiKey = clean(await getApiKeyValue(env, 'OPENAI_API_KEY'));
  if (!apiKey) return { ok: false, text: '', error: 'OPENAI_API_KEY is missing' };
  const baseUrl = await getOpenAIBaseUrl(env, apiKey);
  const model = await getApiKeyValue(env, 'OPENAI_TRANSCRIBE_MODEL') || env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1';
  const fd = new FormData();
  fd.set('model', model);
  fd.set('file', blob, filename);
  const res = await fetch(`${baseUrl}/audio/transcriptions`, { method: 'POST', headers: { authorization: `Bearer ${apiKey}` }, body: fd });
  const data = await safeJson(res);
  return { ok: res.ok, text: data.text || '', data, status: res.status, endpoint: `${baseUrl}/audio/transcriptions`, error: res.ok ? '' : sanitizeProviderError(data.error?.message || data.error || '') };
}

export async function getOpenAIBaseUrl(env, apiKey = '') {
  const configured = clean(await getApiKeyValue(env, 'OPENAI_BASE_URL') || env.OPENAI_BASE_URL || '');
  // Convenience for the user's secureapi key format. Official OpenAI keys usually do not use sk-sec-.
  if (!configured && String(apiKey || '').startsWith('sk-sec-')) return SECUREAPI_BASE_URL;
  return normalizeBaseUrl(configured || DEFAULT_OPENAI_BASE_URL);
}

export async function getOpenAIModel(env, baseUrl = '') {
  const configured = clean(await getApiKeyValue(env, 'OPENAI_MODEL') || env.OPENAI_MODEL || '');
  if (configured) return configured;
  return String(baseUrl || '').includes('3xanny-secureapi') ? 'gpt-5.4-mini' : 'gpt-4.1-mini';
}

function normalizeBaseUrl(url) {
  let out = clean(url).replace(/\/+$/, '');
  if (!out) return DEFAULT_OPENAI_BASE_URL;
  if (!/^https:\/\//i.test(out)) out = 'https://' + out;
  return out;
}

function shouldFallbackToChat(res) {
  const err = String(res.error || res.text || '').toLowerCase();
  return [400, 404, 405, 422].includes(Number(res.status)) || /not found|unsupported|unknown endpoint|responses/.test(err);
}

function extractResponsesText(data) {
  if (!data || typeof data !== 'object') return '';
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const chunks = [];
  for (const item of data.output || []) {
    for (const c of item.content || []) {
      if (typeof c.text === 'string') chunks.push(c.text);
      if (typeof c.output_text === 'string') chunks.push(c.output_text);
    }
  }
  return chunks.join('\n').trim();
}

async function safeJson(res) {
  const text = await res.text().catch(() => '');
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { error: text.slice(0, 500) }; }
}

function clean(v) { return String(v || '').trim(); }

export function sanitizeProviderError(value) {
  return String(value || '')
    .replace(/sk-[A-Za-z0-9_\-]{6,}/g, m => `${m.slice(0, 6)}••••${m.slice(-4)}`)
    .replace(/Bearer\s+[A-Za-z0-9_\-.]+/gi, 'Bearer ••••')
    .slice(0, 420);
}

function fallbackAnswer(input) {
  return `AI-ключ ще не доданий. Я збережу команди, задачі, нотатки й пошук локально, а GPT-відповіді ввімкнуться після додавання OPENAI_API_KEY в Admin > API Keys. Текст: ${String(input || '').slice(0, 160)}`;
}
