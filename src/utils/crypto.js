const enc = new TextEncoder();

export function randomId(prefix = 'id') {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`;
}

export async function sha256Hex(input) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(input ?? '')));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashCode(code) {
  return sha256Hex(`projectseniorservice:v2:access:${String(code || '').trim()}`);
}

export async function hashAdmin(secret) {
  return sha256Hex(`projectseniorservice:v2:admin:${String(secret || '').trim()}`);
}

export function maskSecret(value) {
  const s = String(value || '');
  if (!s) return '';
  if (s.length <= 8) return '••••••';
  return `${s.slice(0, 4)}••••••••${s.slice(-4)}`;
}

export function timingSafeStringEqual(a, b) {
  const aa = enc.encode(String(a ?? ''));
  const bb = enc.encode(String(b ?? ''));
  if (aa.length !== bb.length) return false;
  let out = 0;
  for (let i = 0; i < aa.length; i++) out |= aa[i] ^ bb[i];
  return out === 0;
}

export function base64UrlDecode(input) {
  const normalized = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 ? '='.repeat(4 - (normalized.length % 4)) : '';
  return Uint8Array.from(atob(normalized + pad), c => c.charCodeAt(0));
}

export async function hmacSha256Bytes(keyBytes, data) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return new Uint8Array(sig);
}

export function bytesToHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
