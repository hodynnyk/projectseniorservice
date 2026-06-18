import { loginWithAccessCode, getUserByTelegram } from '../services/auth.js';
import { handleNaturalInput } from '../ai/agent.js';
import { transcribeAudio } from '../ai/openai.js';
import { getApiKeyValue, getSetting } from '../modules/settings.js';
import { logActivity } from '../services/activity.js';

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
      await sendMessage(env, chatId, 'Привіт. Я приватна Соня. Напиши /start ТВОЙ_КОД_ДОСТУПУ.', await miniAppKeyboard(env));
      return new Response('ok');
    }
    try {
      const session = await loginWithAccessCode(env, { accessCode: code, displayName: fullName(tgUser), username: tgUser.username || '', source: 'telegram', telegramId: tgUser.id });
      user = session.user;
      await sendMessage(env, chatId, `Соню активовано для ${escapeTelegram(user.displayName)}.`, await miniAppKeyboard(env));
    } catch (err) {
      await sendMessage(env, chatId, `Код доступу не підійшов або система ще не налаштована. ${err.message || ''}`.slice(0, 500));
    }
    return new Response('ok');
  }

  if (!user) {
    await sendMessage(env, chatId, 'Спочатку прив’яжи акаунт: /start ТВОЙ_КОД_ДОСТУПУ');
    return new Response('ok');
  }

  let input = text;
  if (!input && message.voice) {
    const voice = await downloadTelegramFile(env, message.voice.file_id);
    if (voice.ok) {
      const tr = await transcribeAudio(env, voice.blob, 'voice.ogg');
      input = tr.text || '';
    }
  }
  if (!input) {
    await sendMessage(env, chatId, 'Прийняв, але поки обробляю текст/голос. Фото й файли будуть реєструватися в наступному розширенні R2.');
    return new Response('ok');
  }
  const result = await handleNaturalInput(env, user, input, 'telegram_bot');
  await sendMessage(env, chatId, result.text, await miniAppKeyboard(env));
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
  const publicBaseUrl = await getSetting(env, 'PUBLIC_BASE_URL', env.PUBLIC_BASE_URL || '');
  const url = `${publicBaseUrl.replace(/\/+$/, '')}/miniapp`;
  if (!url.startsWith('https://')) return undefined;
  return { inline_keyboard: [[{ text: 'Відкрити Панель Соні', web_app: { url } }]] };
}

export async function notifyUser(env, userId, text) {
  const users = await import('../services/auth.js').then(m => m.listUsers(env));
  const user = users.find(u => u.id === userId);
  if (!user?.telegramId) return { ok: false, skipped: true, reason: 'telegram not linked' };
  await logActivity(env, { userId, source: 'scheduled', module: 'reminders', action: 'notify', message: text });
  return sendMessage(env, user.telegramId, text, await miniAppKeyboard(env));
}

async function downloadTelegramFile(env, fileId) {
  try {
    const token = await getApiKeyValue(env, 'TELEGRAM_BOT_TOKEN');
    const meta = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`).then(r => r.json());
    const path = meta.result?.file_path;
    if (!path) return { ok: false };
    const res = await fetch(`https://api.telegram.org/file/bot${token}/${path}`);
    return { ok: res.ok, blob: await res.blob() };
  } catch { return { ok: false }; }
}

function fullName(u) { return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'Telegram User'; }
function escapeTelegram(s) { return String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
