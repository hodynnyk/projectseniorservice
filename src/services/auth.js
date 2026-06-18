import { getJson, putJson, upsertRecord, listByIndex } from '../storage/kv.js';
import { hashAdmin, hashCode, randomId, timingSafeStringEqual, hmacSha256Bytes, bytesToHex } from '../utils/crypto.js';
import { nowIso } from '../utils/dates.js';
import { logActivity } from './activity.js';
import { getSetup, setSetup } from '../modules/settings.js';

const SESSION_DAYS = 90;

export async function isConfigured(env) {
  const setup = await getSetup(env);
  return !!setup?.configured;
}

export async function firstSetup(env, body = {}, client = {}) {
  if (await isConfigured(env)) throw Object.assign(new Error('System is already configured'), { status: 403 });
  const adminSecret = String(body.adminSecret || '').trim();
  const ownerCode = String(body.ownerCode || '').trim();
  const familyCode = String(body.familyCode || '').trim();
  if (adminSecret.length < 8) throw Object.assign(new Error('Admin secret must be at least 8 characters'), { status: 400 });
  if (ownerCode.length < 4) throw Object.assign(new Error('Owner code must be at least 4 characters'), { status: 400 });
  const setup = {
    configured: true,
    projectName: 'projectseniorservice',
    assistantName: String(body.assistantName || 'Соня').trim() || 'Соня',
    uiLanguage: String(body.uiLanguage || 'mix'),
    adminSecretHash: await hashAdmin(adminSecret),
    ownerCodeHash: await hashCode(ownerCode),
    familyCodeHash: familyCode ? await hashCode(familyCode) : '',
    publicBaseUrl: String(body.publicBaseUrl || '').trim(),
    createdAt: nowIso(),
    createdFrom: client
  };
  await setSetup(env, setup);
  await putJson(env, 'settings', { PUBLIC_BASE_URL: setup.publicBaseUrl });

  const owner = await createOrUpdateUser(env, {
    id: 'user_owner',
    role: 'owner',
    displayName: String(body.ownerName || 'Owner').trim() || 'Owner',
    username: 'owner',
    privateModeDefault: true
  });
  if (familyCode) {
    await createOrUpdateUser(env, {
      id: 'user_family',
      role: 'family',
      displayName: String(body.familyName || 'Family User').trim() || 'Family User',
      username: 'family',
      privateModeDefault: true
    });
  }
  const initialKeys = body.apiKeys && typeof body.apiKeys === 'object' ? body.apiKeys : {};
  for (const [name, value] of Object.entries(initialKeys)) {
    const cleanName = String(name || '').trim().replace(/[^A-Z0-9_]/gi, '_').toUpperCase();
    const cleanValue = String(value || '').trim();
    if (!cleanName || !cleanValue) continue;
    const row = {
      id: randomId('key'),
      name: cleanName,
      value: cleanValue,
      label: cleanName,
      provider: cleanName.split('_')[0].toLowerCase(),
      active: true,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    await upsertRecord(env, 'secrets', row.id, row, []);
  }
  await logActivity(env, { userId: owner.id, source: 'first_setup', module: 'admin', action: 'configured', message: 'First setup completed', metadata: { ip: client.ip, country: client.country, initialKeys: Object.keys(initialKeys).filter(k => initialKeys[k]).length } });
  return createSession(env, owner, 'admin_setup');
}

export async function loginWithAdminSecret(env, { secret, source = 'admin', publicBaseUrl = '' } = {}) {
  let setup = await getSetup(env);
  if (!setup?.configured) {
    const cleanSecret = String(secret || '').trim();
    if (cleanSecret === 'sonya-admin-2026') {
      await firstSetup(env, { adminSecret: cleanSecret, ownerCode: 'owner2026', familyCode: 'family2026', assistantName: 'Соня', ownerName: 'Owner', familyName: 'Family User', publicBaseUrl }, { ip: '', ua: 'auto-bootstrap-admin', country: '' });
      setup = await getSetup(env);
    } else {
      throw Object.assign(new Error('First setup is not completed. Open /admin and use sonya-admin-2026, or Mini App with owner2026.'), { status: 428 });
    }
  }
  const given = await hashAdmin(secret);
  if (!timingSafeStringEqual(given, setup.adminSecretHash)) throw Object.assign(new Error('Bad admin secret'), { status: 401 });
  const owner = await getUser(env, 'user_owner');
  await logActivity(env, { userId: owner.id, source, module: 'auth', action: 'admin_login', message: 'Admin session created' });
  return createSession(env, owner, source);
}

export async function loginWithAccessCode(env, body = {}) {
  let setup = await getSetup(env);
  const rawCode = String(body.accessCode || '').trim();
  if (!setup?.configured) {
    if (rawCode === 'owner2026' || rawCode === 'family2026') {
      await firstSetup(env, { adminSecret: 'sonya-admin-2026', ownerCode: 'owner2026', familyCode: 'family2026', assistantName: 'Соня', ownerName: 'Owner', familyName: 'Family User', publicBaseUrl: body.publicBaseUrl || '' }, { ip: '', ua: 'auto-bootstrap-login', country: '' });
      setup = await getSetup(env);
    } else {
      throw Object.assign(new Error('First setup is not completed. Use owner2026 once or open /admin.'), { status: 428 });
    }
  }
  const codeHash = await hashCode(rawCode);
  let role = null;
  let id = null;
  if (timingSafeStringEqual(codeHash, setup.ownerCodeHash)) { role = 'owner'; id = 'user_owner'; }
  if (setup.familyCodeHash && timingSafeStringEqual(codeHash, setup.familyCodeHash)) { role = 'family'; id = 'user_family'; }
  if (!role) throw Object.assign(new Error('Bad access code'), { status: 401 });
  const existing = await getUser(env, id);
  const user = await createOrUpdateUser(env, {
    ...existing,
    id,
    role,
    displayName: String(body.displayName || existing?.displayName || (role === 'owner' ? 'Owner' : 'Family User')).trim(),
    username: String(body.username || existing?.username || role),
    telegramId: body.telegramId ? String(body.telegramId) : existing?.telegramId || '',
    lastLoginAt: nowIso()
  });
  await logActivity(env, { userId: user.id, source: body.source || 'login', module: 'auth', action: 'login', message: `Login as ${role}` });
  return createSession(env, user, body.source || 'login');
}

export async function requireUser(env, request) {
  const user = await getUserFromRequest(env, request);
  if (!user) throw Object.assign(new Error('Login required'), { status: 401 });
  return user;
}

export async function requireOwner(env, request) {
  const user = await requireUser(env, request);
  if (user.role !== 'owner') throw Object.assign(new Error('Owner access required'), { status: 403 });
  return user;
}

export async function getUserFromRequest(env, request) {
  const auth = request.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/(?:^|;\s*)sonya_session=([^;]+)/);
  const token = bearer || (match ? decodeURIComponent(match[1]) : '');
  if (!token) return null;
  const session = await getJson(env, `sessions:${token}`);
  if (!session || session.expiresAt < nowIso()) return null;
  const user = await getUser(env, session.userId);
  return user ? publicUser(user) : null;
}

export async function listUsers(env) {
  return (await listByIndex(env, 'users:ids', 'users', 100)).map(publicUser);
}

export async function createInvite(env, user, body = {}) {
  if (user?.role !== 'owner') throw Object.assign(new Error('Owner access required'), { status: 403 });
  const setup = await getSetup(env);
  const code = String(body.code || randomId('invite').slice(0, 14)).replace(/[^a-z0-9_-]/gi, '');
  const role = body.role === 'owner' ? 'owner' : 'family';
  const patch = role === 'owner' ? { ownerCodeHash: await hashCode(code) } : { familyCodeHash: await hashCode(code) };
  await setSetup(env, { ...setup, ...patch });
  await logActivity(env, { userId: user.id, source: 'admin', module: 'auth', action: 'invite_update', message: `${role} access code updated` });
  return { role, code };
}

export async function verifyTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');
    const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
    const secret = await hmacSha256Bytes(new TextEncoder().encode('WebAppData'), botToken);
    const sig = bytesToHex(await hmacSha256Bytes(secret, dataCheckString));
    if (!timingSafeStringEqual(sig, hash)) return null;
    const user = JSON.parse(params.get('user') || '{}');
    return user?.id ? user : null;
  } catch { return null; }
}

export async function getUserByTelegram(env, telegramId) {
  if (!telegramId) return null;
  const users = await listByIndex(env, 'users:ids', 'users', 100);
  const user = users.find(u => String(u.telegramId || '') === String(telegramId));
  return user ? publicUser(user) : null;
}

async function createSession(env, user, source) {
  const token = randomId('sess');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600_000).toISOString();
  await putJson(env, `sessions:${token}`, { token, userId: user.id, source, createdAt: nowIso(), expiresAt }, { expirationTtl: SESSION_DAYS * 24 * 3600 });
  return { token, user: publicUser(user), expiresAt };
}

async function createOrUpdateUser(env, data) {
  const user = {
    id: data.id || randomId('user'),
    role: data.role || 'family',
    displayName: data.displayName || 'User',
    username: data.username || '',
    telegramId: data.telegramId || '',
    privateModeDefault: data.privateModeDefault !== false,
    createdAt: data.createdAt || nowIso(),
    updatedAt: nowIso(),
    lastLoginAt: data.lastLoginAt || null
  };
  await upsertRecord(env, 'users', user.id, user, []);
  return user;
}

async function getUser(env, id) {
  return getJson(env, `users:${id}`);
}

function publicUser(user) {
  if (!user) return null;
  const { id, role, displayName, username, telegramId, privateModeDefault, createdAt, updatedAt, lastLoginAt } = user;
  return { id, role, displayName, username, telegramId, privateModeDefault, createdAt, updatedAt, lastLoginAt };
}
