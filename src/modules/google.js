import { getApiKeyValue, setSetting, getSetting } from './settings.js';
import { logActivity } from '../services/activity.js';
import { nowIso } from '../utils/dates.js';

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly'
];

export async function googleStatus(env, user) {
  const clientId = await getApiKeyValue(env, 'GOOGLE_CLIENT_ID');
  const clientSecret = await getApiKeyValue(env, 'GOOGLE_CLIENT_SECRET');
  const token = user?.id ? await getRefreshToken(env, user.id) : '';
  const publicUrl = await getPublicBaseUrl(env);
  const clientIdLooksValid = looksLikeGoogleOAuthClientId(clientId);
  return {
    configured: !!(clientIdLooksValid && clientSecret),
    connected: !!token,
    account: token ? 'connected OAuth user' : 'not connected',
    clientIdLooksValid,
    clientIdHint: maskGoogleClientId(clientId),
    clientSecretConfigured: !!clientSecret,
    scopes: ['gmail.readonly', 'gmail.send', 'gmail.modify', 'calendar.events', 'calendar.readonly'],
    redirectUri: `${publicUrl}/api/google/callback`,
    setupHint: 'GOOGLE_CLIENT_ID must be an OAuth 2.0 Web Client ID ending with .apps.googleusercontent.com. Do not use API key, refresh token, or client secret here.'
  };
}

export async function googleAuthUrl(env, user) {
  const clientId = await getApiKeyValue(env, 'GOOGLE_CLIENT_ID');
  const publicUrl = await getPublicBaseUrl(env);
  if (!clientId) return { ok: false, error: 'GOOGLE_CLIENT_ID is missing in Admin > API Keys' };
  if (!looksLikeGoogleOAuthClientId(clientId)) return { ok: false, error: 'GOOGLE_CLIENT_ID is wrong. It must be OAuth 2.0 Web Client ID from Google Cloud and end with .apps.googleusercontent.com. This is why Google showed invalid_client.', redirectUri: `${publicUrl}/api/google/callback`, clientIdHint: maskGoogleClientId(clientId) };
  if (!publicUrl) return { ok: false, error: 'PUBLIC_BASE_URL is missing in Admin > API Keys or setup' };
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', `${publicUrl}/api/google/callback`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_SCOPES.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', user.id);
  return { ok: true, url: url.toString(), scopes: GOOGLE_SCOPES };
}

export async function googleCallback(env, code, state) {
  const clientId = await getApiKeyValue(env, 'GOOGLE_CLIENT_ID');
  const clientSecret = await getApiKeyValue(env, 'GOOGLE_CLIENT_SECRET');
  const publicUrl = await getPublicBaseUrl(env);
  if (!code || !clientId || !clientSecret || !publicUrl) return { ok: false, error: 'Missing code, public URL, or Google credentials' };
  if (!looksLikeGoogleOAuthClientId(clientId)) return { ok: false, error: 'GOOGLE_CLIENT_ID is invalid. Use OAuth 2.0 Web Client ID ending with .apps.googleusercontent.com.' };
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: `${publicUrl}/api/google/callback`, grant_type: 'authorization_code' })
  });
  const data = await res.json().catch(() => ({}));
  if (data.refresh_token && state) {
    await setSetting(env, { id: state }, `google_refresh_token:${state}`, data.refresh_token, true);
    await setSetting(env, { id: state }, `google_connected_at:${state}`, nowIso(), false);
  }
  await logActivity(env, { userId: state, source: 'google', module: 'google', action: res.ok ? 'oauth_connected' : 'oauth_error', message: String(data.error || 'callback'), metadata: { scope: data.scope || '', hasRefreshToken: !!data.refresh_token } });
  return { ok: res.ok, status: res.status, data: { ...data, access_token: data.access_token ? '[hidden]' : undefined, refresh_token: data.refresh_token ? '[saved]' : undefined } };
}

export async function listGmailMessages(env, user, options = {}) {
  const token = await getGoogleAccessToken(env, user);
  const q = String(options.q || 'newer_than:14d').slice(0, 240);
  const maxResults = Math.min(Math.max(Number(options.limit || options.maxResults || 10), 1), 20);
  const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  listUrl.searchParams.set('q', q);
  listUrl.searchParams.set('maxResults', String(maxResults));
  const listRes = await googleFetch(listUrl.toString(), token);
  const listData = await listRes.json().catch(() => ({}));
  if (!listRes.ok) return failGoogle('gmail_list_error', listRes.status, listData);
  const messages = [];
  for (const m of (listData.messages || []).slice(0, maxResults)) {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(m.id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date&metadataHeaders=To`;
    const res = await googleFetch(url, token);
    const data = await res.json().catch(() => ({}));
    if (res.ok) messages.push(normalizeGmailMessage(data));
  }
  await logActivity(env, { userId: user.id, source: 'google', module: 'gmail', action: 'list', message: q, metadata: { count: messages.length } });
  return { ok: true, q, messages };
}

export async function readGmailMessage(env, user, messageId) {
  const token = await getGoogleAccessToken(env, user);
  const res = await googleFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=full`, token);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return failGoogle('gmail_read_error', res.status, data);
  const msg = normalizeGmailMessage(data);
  msg.bodyText = extractGmailText(data.payload).slice(0, 8000);
  await logActivity(env, { userId: user.id, source: 'google', module: 'gmail', action: 'read', message: msg.subject || messageId });
  return { ok: true, message: msg };
}

export async function sendGmailMessage(env, user, body = {}) {
  const token = await getGoogleAccessToken(env, user);
  const to = String(body.to || '').trim();
  const subject = String(body.subject || '').trim() || 'Message from Соня';
  const text = String(body.text || body.body || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { ok: false, error: 'Valid recipient email is required' };
  if (!text) return { ok: false, error: 'Email text is required' };
  const fromName = encodeHeader(String(body.fromName || 'Соня'));
  const raw = base64UrlEncode(`From: ${fromName}\r\nTo: ${to}\r\nSubject: ${encodeHeader(subject)}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${text}`);
  const res = await googleFetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', token, { method: 'POST', body: JSON.stringify({ raw }) });
  const data = await res.json().catch(() => ({}));
  await logActivity(env, { userId: user.id, source: 'google', module: 'gmail', action: res.ok ? 'send' : 'send_error', message: `${to} · ${subject}`, metadata: { status: res.status } });
  return res.ok ? { ok: true, id: data.id, threadId: data.threadId } : failGoogle('gmail_send_error', res.status, data);
}

export async function listCalendarEvents(env, user, options = {}) {
  const token = await getGoogleAccessToken(env, user);
  const range = normalizeCalendarRange(options);
  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  url.searchParams.set('timeMin', range.timeMin);
  url.searchParams.set('timeMax', range.timeMax);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', String(Math.min(Math.max(Number(options.limit || 12), 1), 30)));
  const res = await googleFetch(url.toString(), token);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return failGoogle('calendar_list_error', res.status, data);
  const events = (data.items || []).map(e => ({ id: e.id, summary: e.summary || '(без назви)', description: e.description || '', location: e.location || '', start: e.start?.dateTime || e.start?.date || '', end: e.end?.dateTime || e.end?.date || '', htmlLink: e.htmlLink || '' }));
  await logActivity(env, { userId: user.id, source: 'google', module: 'calendar', action: 'list', message: options.range || 'custom', metadata: { count: events.length } });
  return { ok: true, range, events };
}

export async function createCalendarEvent(env, user, body = {}) {
  const token = await getGoogleAccessToken(env, user);
  const summary = String(body.summary || body.title || '').trim();
  const start = String(body.start || body.startTime || '').trim();
  const end = String(body.end || body.endTime || '').trim();
  const timezone = String(body.timezone || 'Europe/Kyiv');
  if (!summary) return { ok: false, error: 'Event summary is required' };
  if (!start || !end) return { ok: false, error: 'Event start and end ISO times are required' };
  const payload = { summary, description: String(body.description || ''), location: String(body.location || ''), start: { dateTime: start, timeZone: timezone }, end: { dateTime: end, timeZone: timezone } };
  const res = await googleFetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', token, { method: 'POST', body: JSON.stringify(payload) });
  const data = await res.json().catch(() => ({}));
  await logActivity(env, { userId: user.id, source: 'google', module: 'calendar', action: res.ok ? 'create' : 'create_error', message: summary, metadata: { status: res.status } });
  return res.ok ? { ok: true, event: { id: data.id, summary: data.summary, start: data.start?.dateTime, end: data.end?.dateTime, htmlLink: data.htmlLink } } : failGoogle('calendar_create_error', res.status, data);
}

export async function getGoogleAccessToken(env, user) {
  if (!user?.id) throw Object.assign(new Error('Google user context is missing'), { status: 401 });
  const refreshToken = await getRefreshToken(env, user.id);
  const clientId = await getApiKeyValue(env, 'GOOGLE_CLIENT_ID');
  const clientSecret = await getApiKeyValue(env, 'GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw Object.assign(new Error('Google Client ID/Secret missing in Admin > API Keys'), { status: 400 });
  if (!refreshToken) throw Object.assign(new Error('Google account is not connected. Open Admin/Mini App → Google → Connect Google.'), { status: 428 });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw Object.assign(new Error(data.error_description || data.error || 'Google token refresh failed'), { status: 502 });
  return data.access_token;
}

async function getRefreshToken(env, userId) {
  return await getSetting(env, `google_refresh_token:${userId}`, '');
}

async function getPublicBaseUrl(env) {
  return (await getSetting(env, 'PUBLIC_BASE_URL', '')) || env.PUBLIC_BASE_URL || '';
}

async function googleFetch(url, accessToken, init = {}) {
  return fetch(url, { ...init, headers: { accept: 'application/json', 'content-type': 'application/json', authorization: `Bearer ${accessToken}`, ...(init.headers || {}) } });
}

function normalizeGmailMessage(data) {
  const headers = Object.fromEntries((data.payload?.headers || []).map(h => [String(h.name || '').toLowerCase(), h.value || '']));
  return { id: data.id, threadId: data.threadId, labelIds: data.labelIds || [], from: headers.from || '', to: headers.to || '', subject: headers.subject || '(без теми)', date: headers.date || '', snippet: data.snippet || '' };
}

function extractGmailText(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) return base64UrlDecode(payload.body.data);
  if (payload.parts?.length) return payload.parts.map(extractGmailText).filter(Boolean).join('\n').trim();
  if (payload.body?.data) return base64UrlDecode(payload.body.data);
  return '';
}

function base64UrlDecode(input) {
  const normalized = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  try {
    const bin = atob(padded);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch { return ''; }
}

function base64UrlEncode(input) {
  const bytes = new TextEncoder().encode(String(input || ''));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function encodeHeader(s) {
  return `=?UTF-8?B?${base64UrlEncode(String(s || '')).replace(/-/g, '+').replace(/_/g, '/')}?=`;
}

function normalizeCalendarRange(options = {}) {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);
  const range = String(options.range || '').toLowerCase();
  if (range === 'tomorrow') {
    start.setDate(start.getDate() + 1); start.setHours(0,0,0,0);
    end = new Date(start); end.setDate(end.getDate() + 1);
  } else if (range === 'week') {
    start.setHours(0,0,0,0); end.setDate(end.getDate() + 7);
  } else {
    start.setHours(0,0,0,0); end.setDate(end.getDate() + 1);
  }
  return { timeMin: String(options.timeMin || start.toISOString()), timeMax: String(options.timeMax || end.toISOString()) };
}

function failGoogle(code, status, data) {
  return { ok: false, code, status, error: data?.error?.message || data?.error_description || data?.error || 'Google API error', details: data };
}

function looksLikeGoogleOAuthClientId(value) {
  const v = String(value || '').trim();
  return /^[0-9a-zA-Z_-]+-[0-9a-zA-Z_-]+\.apps\.googleusercontent\.com$/.test(v) || /^[0-9]+-[0-9a-zA-Z_-]+\.apps\.googleusercontent\.com$/.test(v);
}

function maskGoogleClientId(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  const tail = v.endsWith('.apps.googleusercontent.com') ? '.apps.googleusercontent.com' : v.slice(-10);
  return `${v.slice(0, 6)}••••${tail}`;
}
