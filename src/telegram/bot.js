import { loginWithAccessCode, getUserByTelegram } from '../services/auth.js';
import { handleNaturalInput } from '../ai/agent.js';
import { getApiKeyValue, getSetting } from '../modules/settings.js';
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
    await sendMessage(env, chatId, user.role === 'owner'
      ? 'Сер, голосові запити я зараз не обробляю: вимкнула цей шлях, щоб не тягнути зайві файли й не витрачати ресурси. Напишіть текстом — я відпрацюю акуратно.'
      : 'Голос зараз вимкнено для економії ресурсів. Напиши, будь ласка, текстом.');
    return new Response('ok');
  }

  const telegramFile = pickTelegramFile(message);
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

export async function miniAppKeyboard(env) {
  // v15: Telegram bot replies with clean contextual text only.
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
