import { getApiKeyValue, getSetting } from './settings.js';
import { logActivity } from '../services/activity.js';

export async function geminiStatus(env) {
  const key = await getGeminiApiKey(env);
  return {
    configured: !!key,
    primary: false,
    role: 'sidecar',
    model: await getGeminiModel(env),
    note: key ? 'Gemini ready as secondary AI' : 'GEMINI_API_KEY is missing in Admin > API Keys'
  };
}

export async function askGemini(env, user, prompt, source = 'api') {
  const apiKey = await getGeminiApiKey(env);
  if (!apiKey) return { ok: false, text: 'Gemini API key не доданий. Додайте GEMINI_API_KEY в Admin → API Keys.', provider: 'gemini' };
  const model = await getGeminiModel(env);
  const clean = String(prompt || '').trim();
  if (!clean) return { ok: false, text: 'Порожній запит для Gemini.', provider: 'gemini' };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: clean.slice(0, 8000) }] }],
      generationConfig: { temperature: 0.35, maxOutputTokens: 900 }
    })
  });
  const data = await res.json().catch(() => ({}));
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim() || data?.error?.message || '';
  await logActivity(env, { userId: user?.id, source, module: 'gemini', action: res.ok ? 'generate' : 'error', message: clean.slice(0, 120), metadata: { model, status: res.status } });
  return { ok: res.ok, provider: 'gemini', model, status: res.status, text: text || 'Gemini не повернув текст.', rawId: data?.responseId || '' };
}

async function getGeminiApiKey(env) {
  return await getApiKeyValue(env, 'GEMINI_API_KEY') || env.GEMINI_API_KEY || '';
}

async function getGeminiModel(env) {
  return await getApiKeyValue(env, 'GEMINI_MODEL') || await getSetting(env, 'GEMINI_MODEL', '') || env.GEMINI_MODEL || 'gemini-2.5-flash';
}
