import { getApiKeyValue, setSetting, getSetting } from './settings.js';
import { logActivity } from '../services/activity.js';

export async function googleStatus(env, user) {
  const clientId = await getApiKeyValue(env, 'GOOGLE_CLIENT_ID');
  const clientSecret = await getApiKeyValue(env, 'GOOGLE_CLIENT_SECRET');
  const token = await getSetting(env, `google_refresh_token:${user.id}`, '');
  return { configured: !!(clientId && clientSecret), connected: !!token, scopes: ['calendar', 'tasks', 'drive.metadata', 'contacts.readonly'] };
}

export async function googleAuthUrl(env, user) {
  const clientId = await getApiKeyValue(env, 'GOOGLE_CLIENT_ID');
  const publicUrl = await getPublicBaseUrl(env);
  if (!clientId) return { ok: false, error: 'GOOGLE_CLIENT_ID is missing in Admin > API Keys' };
  const scopes = ['https://www.googleapis.com/auth/calendar','https://www.googleapis.com/auth/tasks','https://www.googleapis.com/auth/drive.metadata.readonly','https://www.googleapis.com/auth/contacts.readonly'];
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', `${publicUrl}/api/google/callback`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', user.id);
  return { ok: true, url: url.toString() };
}

export async function googleCallback(env, code, state) {
  const clientId = await getApiKeyValue(env, 'GOOGLE_CLIENT_ID');
  const clientSecret = await getApiKeyValue(env, 'GOOGLE_CLIENT_SECRET');
  const publicUrl = await getPublicBaseUrl(env);
  if (!code || !clientId || !clientSecret) return { ok: false, error: 'Missing code or Google credentials' };
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: `${publicUrl}/api/google/callback`, grant_type: 'authorization_code' }) });
  const data = await res.json().catch(() => ({}));
  if (data.refresh_token && state) await setSetting(env, { id: state }, `google_refresh_token:${state}`, data.refresh_token, true);
  await logActivity(env, { userId: state, source: 'google', module: 'google', action: res.ok ? 'oauth_connected' : 'oauth_error', message: String(data.error || 'callback') });
  return { ok: res.ok, status: res.status, data: { ...data, access_token: data.access_token ? '[hidden]' : undefined, refresh_token: data.refresh_token ? '[saved]' : undefined } };
}

async function getPublicBaseUrl(env) {
  return (await getSetting(env, 'PUBLIC_BASE_URL', '')) || env.PUBLIC_BASE_URL || '';
}
