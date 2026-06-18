export function getPath(request) {
  return new URL(request.url).pathname.replace(/\/+$/, '') || '/';
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers
    }
  });
}

export function html(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      ...headers
    }
  });
}

export function text(body, status = 200, headers = {}) {
  return new Response(String(body), {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      ...headers
    }
  });
}

export function redirect(location, status = 302) {
  return new Response(null, { status, headers: { location } });
}

export function error(message, status = 400, extra = {}) {
  return json({ ok: false, error: String(message || 'Error'), ...extra }, status);
}

export async function readJson(request) {
  const raw = await request.text();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw Object.assign(new Error('Invalid JSON body'), { status: 400 }); }
}

export function sanitizeString(value, max = 500) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function cookie(name, value, maxAge = 90 * 24 * 3600) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export function getClientInfo(request) {
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
  const ua = request.headers.get('user-agent') || '';
  const country = request.cf?.country || request.headers.get('cf-ipcountry') || '';
  return { ip, ua, country };
}
