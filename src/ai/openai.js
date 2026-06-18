import { getApiKeyValue } from '../modules/settings.js';

export async function askOpenAI(env, { instructions, input, context = [] } = {}) {
  const apiKey = await getApiKeyValue(env, 'OPENAI_API_KEY');
  if (!apiKey) {
    return { ok: false, text: fallbackAnswer(input), missingKey: true };
  }
  const model = (await getApiKeyValue(env, 'OPENAI_MODEL')) || env.OPENAI_MODEL || 'gpt-4.1-mini';
  const body = {
    model,
    store: false,
    input: [
      { role: 'system', content: instructions || 'You are Sonia, a private family assistant. Be concise and useful.' },
      { role: 'user', content: JSON.stringify({ input, privateContext: context }, null, 2) }
    ]
  };
  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    const text = data.output_text || data.output?.flatMap(x => x.content || []).map(c => c.text || '').join('\n').trim() || data.error?.message || '';
    return { ok: res.ok, text, rawId: data.id || null, status: res.status };
  } catch (err) {
    return { ok: false, text: `AI тимчасово недоступний: ${err.message}`, error: err.message };
  }
}

export async function transcribeAudio(env, blob, filename = 'voice.ogg') {
  const apiKey = await getApiKeyValue(env, 'OPENAI_API_KEY');
  if (!apiKey) return { ok: false, text: '', error: 'OPENAI_API_KEY is missing' };
  const model = env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe';
  const fd = new FormData();
  fd.set('model', model);
  fd.set('file', blob, filename);
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { authorization: `Bearer ${apiKey}` }, body: fd });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, text: data.text || '', data };
}

function fallbackAnswer(input) {
  return `AI-ключ ще не доданий. Я збережу команди, задачі, нотатки й пошук локально, а GPT-відповіді ввімкнуться після додавання OPENAI_API_KEY в Admin > API Keys. Текст: ${String(input || '').slice(0, 160)}`;
}
