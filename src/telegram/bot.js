import { loginWithAccessCode, getUserByTelegram } from '../services/auth.js';
import { handleNaturalInput } from '../ai/agent.js';
import { getOpenAIBaseUrl, getOpenAIModel, sanitizeProviderError } from '../ai/openai.js';
import { getApiKeyValue, getSetting } from '../modules/settings.js';
import { appendConversationTurn } from '../modules/conversation.js';
import { logActivity } from '../services/activity.js';
import { registerFileMetadata } from '../modules/files.js';

export async function handleTelegramWebhook(env, request) {
  const update = await request.json().catch(() => ({}));
  const message = update.message || update.edited_message;
  if (!message) return new Response('ok');
  const chatId = message.chat?.id;
  const tgUser = message.from || {};
  let user = await getUserByTelegram(env, tgUser.id);
  const text = message.text || message.caption || '';

  if (text.startsWith('/start')) {
    const code = text.replace('/start', '').trim();
    if (!code) {
      await sendMessage(env, chatId, 'Привіт. Я приватна Соня. Напиши /start ТВОЙ_КОД_ДОСТУПУ.');
      return new Response('ok');
    }
    try {
      const session = await loginWithAccessCode(env, { accessCode: code, displayName: fullName(tgUser), username: tgUser.username || '', source: 'telegram', telegramId: tgUser.id });
      user = session.user;
      await sendMessage(env, chatId, user.role === 'owner' ? `Соню активовано для ${escapeTelegram(user.displayName)}. Я поруч, сер.` : `Соню активовано для ${escapeTelegram(user.displayName)}.`);
    } catch (err) {
      await sendMessage(env, chatId, `Код доступу не підійшов або система ще не налаштована. ${err.message || ''}`.slice(0, 500));
    }
    return new Response('ok');
  }

  if (!user) {
    await sendMessage(env, chatId, 'Спочатку прив’яжи акаунт: /start ТВОЙ_КОД_ДОСТУПУ');
    return new Response('ok');
  }

  const input = text;

  if (message.voice || message.audio) {
    const voiceInfo = message.voice
      ? { fileId: message.voice.file_id, size: message.voice.file_size || 0, duration: message.voice.duration || 0, mimeType: message.voice.mime_type || 'audio/ogg', name: 'telegram-voice.ogg' }
      : { fileId: message.audio.file_id, size: message.audio.file_size || 0, duration: message.audio.duration || 0, mimeType: message.audio.mime_type || 'audio/mpeg', name: message.audio.file_name || 'telegram-audio.mp3' };
    try {
      await sendChatAction(env, chatId, 'typing');
      const tr = await transcribeTelegramAudio(env, voiceInfo);
      if (!tr.ok || !tr.text) {
        await sendMessage(env, chatId, user.role === 'owner'
          ? `Сер, голосове отримала, але не змогла розшифрувати: ${escapeTelegram(tr.error || 'невідома помилка')}. Аудіо не зберігала.`
          : `Голосове отримала, але не змогла розшифрувати: ${escapeTelegram(tr.error || 'невідома помилка')}.`);
        return new Response('ok');
      }
      await appendConversationTurn(env, user, 'telegram_bot', 'user_voice', tr.text, { duration: voiceInfo.duration, storedAudio: false });
      const result = await handleNaturalInput(env, user, tr.text, 'telegram_bot');
      await sendMessage(env, chatId, `${user.role === 'owner' ? 'Почула, сер' : 'Почула'}: “${escapeTelegram(tr.text.slice(0, 220))}”\n\n${result.text}`);
    } catch (err) {
      await sendMessage(env, chatId, user.role === 'owner'
        ? `Сер, голосове не обробилось. Аудіо не зберігала. Причина: ${escapeTelegram(err.message || 'unknown')}`
        : `Голосове не обробилось. Причина: ${escapeTelegram(err.message || 'unknown')}`);
    }
    return new Response('ok');
  }

  const telegramFile = pickTelegramFile(message);
  if (telegramFile && telegramFile.kind === 'photo' && !shouldStoreIncomingFile(input)) {
    await sendChatAction(env, chatId, 'typing');
    const seen = await analyzeTelegramPhoto(env, user, telegramFile, input || 'Опиши фото і дай корисну відповідь.');
    await sendMessage(env, chatId, seen.ok
      ? seen.text
      : (user.role === 'owner' ? `Сер, фото бачу, але vision зараз не відповів: ${escapeTelegram(seen.error || 'unknown')}. Файл не зберігала.` : `Фото бачу, але vision зараз не відповів: ${escapeTelegram(seen.error || 'unknown')}.`));
    return new Response('ok');
  }

  if (telegramFile && !shouldStoreIncomingFile(input)) {
    await sendMessage(env, chatId, user.role === 'owner'
      ? 'Сер, файл бачу. За вашим правилом я не тягну його в R2 і не зберігаю без явної команди. Якщо треба — надішліть із підписом “збережи як документ” або “додай у сімейні файли”.'
      : 'Файл бачу, але без команди не зберігаю. Надішли з підписом “збережи фото/документ”, якщо треба додати картку.');
    return new Response('ok');
  }

  if (telegramFile) {
    try {
      const saved = await registerFileMetadata(env, user, {
        name: telegramFile.name,
        mimeType: telegramFile.mimeType,
        size: telegramFile.size,
        title: input || telegramFile.title || telegramFile.name,
        description: input || '',
        visibility: /сім|сем|shared|друж|жена|wife/i.test(input) ? 'shared' : 'private',
        tags: ['telegram', telegramFile.kind].filter(Boolean),
        source: 'telegram_bot',
        metadata: { telegram: { kind: telegramFile.kind, fileId: telegramFile.fileId }, binaryStored: false, r2Disabled: true }
      });
      const extra = input ? '\nПідпис також обробляю як команду.' : '';
      await sendMessage(env, chatId, `Зберегла легку картку файлу без R2: ${escapeTelegram(saved.title)}\nID: ${escapeTelegram(saved.id)}${extra}`);
      if (!input) return new Response('ok');
    } catch (err) {
      await sendMessage(env, chatId, `Файл побачила, але картку не створила: ${escapeTelegram(err.message || 'unknown error')}`);
      if (!input) return new Response('ok');
    }
  }

  if (!input) {
    await sendMessage(env, chatId, user.role === 'owner'
      ? 'Я поруч, сер. Напишіть текстом команду або питання — розберу без зайвих записів.'
      : 'Напиши команду або питання текстом.');
    return new Response('ok');
  }
  const result = await handleNaturalInput(env, user, input, 'telegram_bot');
  await sendMessage(env, chatId, result.text);
  return new Response('ok');
}

export async function resolveTelegramWebhookUrl(env) {
  const publicBaseUrl = await getSetting(env, 'PUBLIC_BASE_URL', env.PUBLIC_BASE_URL || '');
  const webhookSecret = await getApiKeyValue(env, 'TELEGRAM_WEBHOOK_SECRET') || env.TELEGRAM_WEBHOOK_SECRET || 'telegram';
  if (!publicBaseUrl) return { ok: false, error: 'PUBLIC_BASE_URL is required' };
  return {
    ok: true,
    publicBaseUrl: publicBaseUrl.replace(/\/+$/, ''),
    webhookSecret,
    url: `${publicBaseUrl.replace(/\/+$/, '')}/telegram/webhook/${encodeURIComponent(webhookSecret)}`
  };
}

export async function setTelegramWebhook(env) {
  const token = await getApiKeyValue(env, 'TELEGRAM_BOT_TOKEN');
  if (!token) return { ok: false, error: 'TELEGRAM_BOT_TOKEN is required' };
  const target = await resolveTelegramWebhookUrl(env);
  if (!target.ok) return target;
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      url: target.url,
      drop_pending_updates: true,
      allowed_updates: ['message', 'edited_message']
    })
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && data.ok !== false, url: target.url, telegram: data };
}

export async function getTelegramWebhookStatus(env) {
  const token = await getApiKeyValue(env, 'TELEGRAM_BOT_TOKEN');
  const target = await resolveTelegramWebhookUrl(env);
  if (!token) return { ok: false, configured: false, error: 'TELEGRAM_BOT_TOKEN is missing', expectedUrl: target.url || '' };
  const [meRes, infoRes] = await Promise.allSettled([
    fetch(`https://api.telegram.org/bot${token}/getMe`).then(r => r.json()),
    fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then(r => r.json())
  ]);
  const me = meRes.status === 'fulfilled' ? meRes.value : { ok: false, description: meRes.reason?.message || 'getMe failed' };
  const info = infoRes.status === 'fulfilled' ? infoRes.value : { ok: false, description: infoRes.reason?.message || 'getWebhookInfo failed' };
  const currentUrl = info?.result?.url || '';
  const expectedUrl = target.url || '';
  return {
    ok: !!me.ok && !!info.ok,
    configured: !!currentUrl && (!expectedUrl || currentUrl === expectedUrl),
    bot: me?.result ? { id: me.result.id, username: me.result.username, first_name: me.result.first_name } : null,
    expectedUrl,
    currentUrl,
    pendingUpdateCount: info?.result?.pending_update_count ?? null,
    lastErrorDate: info?.result?.last_error_date || null,
    lastErrorMessage: info?.result?.last_error_message || '',
    telegram: { me, webhookInfo: info }
  };
}

export async function sendMessage(env, chatId, text, replyMarkup = undefined) {
  const token = await getApiKeyValue(env, 'TELEGRAM_BOT_TOKEN');
  if (!token || !chatId) return { ok: false, skipped: true, reason: 'TELEGRAM_BOT_TOKEN missing or chatId missing' };
  const body = { chat_id: chatId, text: String(text || '').slice(0, 3900), parse_mode: 'HTML' };
  if (replyMarkup) body.reply_markup = replyMarkup;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return res.json().catch(() => ({ ok: res.ok, status: res.status }));
}

export async function sendPhoto(env, chatId, photoUrl, caption = '') {
  const token = await getApiKeyValue(env, 'TELEGRAM_BOT_TOKEN');
  if (!token || !chatId || !photoUrl) return { ok: false, skipped: true };
  const body = { chat_id: chatId, photo: photoUrl, caption: String(caption || '').slice(0, 900), parse_mode: 'HTML' };
  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return res.json().catch(() => ({ ok: res.ok, status: res.status }));
}

export async function miniAppKeyboard(env) {
  // v22: Telegram bot replies with clean contextual text only.
  // The Mini App is opened separately through Telegram Mini Apps / bot menu.
  return undefined;
}

export async function notifyUser(env, userId, text) {
  const users = await import('../services/auth.js').then(m => m.listUsers(env));
  const user = users.find(u => u.id === userId);
  if (!user?.telegramId) return { ok: false, skipped: true, reason: 'telegram not linked' };
  await logActivity(env, { userId, source: 'scheduled', module: 'reminders', action: 'notify', message: text });
  return sendMessage(env, user.telegramId, text);
}


async function analyzeTelegramPhoto(env, user, fileInfo, caption = '') {
  const openaiKey = await getApiKeyValue(env, 'OPENAI_API_KEY');
  const token = await getApiKeyValue(env, 'TELEGRAM_BOT_TOKEN');
  if (!openaiKey) return { ok: false, error: 'OPENAI_API_KEY не налаштований' };
  if (!token) return { ok: false, error: 'TELEGRAM_BOT_TOKEN не налаштований' };
  if (fileInfo.size && fileInfo.size > 1400 * 1024) return { ok: false, error: 'фото завелике для прямого vision без R2' };
  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileInfo.fileId)}`);
  const info = await infoRes.json().catch(() => ({}));
  const filePath = info?.result?.file_path;
  if (!infoRes.ok || !info.ok || !filePath) return { ok: false, error: info.description || 'Telegram getFile failed' };
  const fileRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
  if (!fileRes.ok) return { ok: false, error: `Telegram file download failed ${fileRes.status}` };
  const blob = await fileRes.blob();
  const dataUrl = await blobToDataUrl(blob, fileInfo.mimeType || 'image/jpeg');
  const baseUrl = await getOpenAIBaseUrl(env, openaiKey);
  const model = await getOpenAIModel(env, baseUrl);
  const system = user?.role === 'owner'
    ? 'Ти Соня, приватна помічниця Owner. Проаналізуй фото коротко, корисно, українською/суржиком. Не зберігай файл, не вигадуй приватні дані.'
    : 'Ти сімейна помічниця Соня. Проаналізуй фото нейтрально, коротко і корисно. Не зберігай файл.';
  const body = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: [
        { type: 'text', text: String(caption || 'Що на фото? Дай корисну відповідь.').slice(0, 1200) },
        { type: 'image_url', image_url: { url: dataUrl } }
      ] }
    ]
  };
  const res = await fetch(`${baseUrl}/chat/completions`, { method: 'POST', headers: { authorization: `Bearer ${openaiKey}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  const text = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '';
  if (!res.ok || !text) return { ok: false, error: sanitizeProviderError(data.error?.message || data.error || `vision failed ${res.status}`) };
  await logActivity(env, { userId: user.id, source: 'telegram_bot', module: 'vision', action: 'photo_analyze', message: String(caption || '').slice(0, 80), metadata: { stored: false, model } });
  return { ok: true, text: String(text).slice(0, 3600), stored: false };
}

async function blobToDataUrl(blob, mimeType = 'image/jpeg') {
  const arr = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < arr.length; i += chunk) binary += String.fromCharCode(...arr.subarray(i, i + chunk));
  return `data:${mimeType};base64,${btoa(binary)}`;
}

async function transcribeTelegramAudio(env, voiceInfo) {
  const openaiKey = await getApiKeyValue(env, 'OPENAI_API_KEY');
  const token = await getApiKeyValue(env, 'TELEGRAM_BOT_TOKEN');
  if (!openaiKey) return { ok: false, error: 'OPENAI_API_KEY не налаштований' };
  if (!token) return { ok: false, error: 'TELEGRAM_BOT_TOKEN не налаштований' };
  if (!voiceInfo?.fileId) return { ok: false, error: 'немає Telegram file_id' };
  if (voiceInfo.size && voiceInfo.size > 18 * 1024 * 1024) return { ok: false, error: 'голосове завелике для прямої обробки без R2' };
  const baseUrl = await getOpenAIBaseUrl(env, openaiKey);
  const transcribeModel = await getApiKeyValue(env, 'OPENAI_TRANSCRIBE_MODEL') || env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1';

  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(voiceInfo.fileId)}`);
  const info = await infoRes.json().catch(() => ({}));
  const filePath = info?.result?.file_path;
  if (!infoRes.ok || !info.ok || !filePath) return { ok: false, error: info.description || 'Telegram getFile failed' };

  const fileRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
  if (!fileRes.ok) return { ok: false, error: `Telegram file download failed ${fileRes.status}` };
  const blob = await fileRes.blob();

  const fd = new FormData();
  fd.append('model', transcribeModel);
  fd.append('language', 'uk');
  fd.append('response_format', 'json');
  fd.append('file', blob, voiceInfo.name || 'telegram-voice.ogg');

  const trRes = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${openaiKey}` },
    body: fd
  });
  const data = await trRes.json().catch(() => ({}));
  if (!trRes.ok) return { ok: false, error: sanitizeProviderError(data.error?.message || data.error || `OpenAI transcription failed ${trRes.status}`) }; 
  return { ok: true, text: String(data.text || '').trim(), storedAudio: false };
}

async function sendChatAction(env, chatId, action = 'typing') {
  const token = await getApiKeyValue(env, 'TELEGRAM_BOT_TOKEN');
  if (!token || !chatId) return { ok: false };
  return fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action })
  }).then(r => r.json()).catch(() => ({ ok: false }));
}

function pickTelegramFile(message) {
  if (message.photo?.length) {
    const sizes = [...message.photo].sort((a, b) => (a.file_size || 0) - (b.file_size || 0));
    const p = sizes.find(x => (x.file_size || 0) >= 120 * 1024 && (x.file_size || 0) <= 900 * 1024) || sizes.find(x => (x.file_size || 0) <= 900 * 1024) || sizes[0];
    return { kind: 'photo', fileId: p.file_id, name: `telegram-photo-${Date.now()}.jpg`, mimeType: 'image/jpeg', size: p.file_size || 0, title: 'Telegram photo' };
  }
  if (message.document) return { kind: 'document', fileId: message.document.file_id, name: message.document.file_name || `telegram-document-${Date.now()}`, mimeType: message.document.mime_type || 'application/octet-stream', size: message.document.file_size || 0, title: message.document.file_name || 'Telegram document' };
  if (message.video) return { kind: 'video', fileId: message.video.file_id, name: `telegram-video-${Date.now()}.mp4`, mimeType: message.video.mime_type || 'video/mp4', size: message.video.file_size || 0, title: 'Telegram video' };
  if (message.audio) return { kind: 'audio', fileId: message.audio.file_id, name: message.audio.file_name || `telegram-audio-${Date.now()}.mp3`, mimeType: message.audio.mime_type || 'audio/mpeg', size: message.audio.file_size || 0, title: message.audio.file_name || 'Telegram audio' };
  return null;
}

function shouldStoreIncomingFile(text) {
  const s = String(text || '').toLowerCase();
  return /збережи|сохрани|запиши|додай|добавь|файл|документ|чек|гарант|фото|photo|save|store|upload/.test(s);
}

function fullName(u) { return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'Telegram User'; }
function escapeTelegram(s) { return String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
