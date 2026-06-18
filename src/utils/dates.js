export function nowIso() { return new Date().toISOString(); }

export function addMs(date, ms) { return new Date(date.getTime() + ms); }

export function parseLooseDueAt(text, timezone = 'Europe/Kyiv') {
  const raw = String(text || '').toLowerCase();
  const now = new Date();
  let due = null;
  let recurrence = null;

  const afterHours = raw.match(/(?:через|за|in)\s+(\d{1,3})\s*(?:год|час|hour|h)/i);
  const afterMins = raw.match(/(?:через|за|in)\s+(\d{1,3})\s*(?:хв|мин|minute|m)/i);
  if (afterHours) due = addMs(now, Number(afterHours[1]) * 3600_000);
  if (afterMins) due = addMs(now, Number(afterMins[1]) * 60_000);

  if (!due && /(завтра|tomorrow)/i.test(raw)) {
    due = new Date(now);
    due.setDate(due.getDate() + 1);
    due.setHours(/веч|вечер|evening/i.test(raw) ? 19 : /ран|утр|morning/i.test(raw) ? 9 : 12, 0, 0, 0);
  }
  if (!due && /(сьогодні|сегодня|today)/i.test(raw)) {
    due = new Date(now);
    due.setHours(/веч|вечер|evening/i.test(raw) ? 19 : /ран|утр|morning/i.test(raw) ? 9 : 15, 0, 0, 0);
    if (due < now) due = addMs(now, 3600_000);
  }
  const atTime = raw.match(/(?:о|в|at)\s*(\d{1,2})(?::|\.)(\d{2})/i) || raw.match(/(?:о|в|at)\s*(\d{1,2})\s*(?:год|час|h)?\b/i);
  if (atTime) {
    const base = due || new Date(now);
    base.setHours(Math.min(23, Number(atTime[1])), atTime[2] ? Math.min(59, Number(atTime[2])) : 0, 0, 0);
    if (base < now && !/(завтра|tomorrow)/i.test(raw)) base.setDate(base.getDate() + 1);
    due = base;
  }
  if (/(кожн|кажд|every)\s*(ран|утр|morning|день|day)/i.test(raw)) recurrence = 'daily';
  if (/(кожн|кажд|every)\s*(тиж|недел|week)/i.test(raw)) recurrence = 'weekly';

  return { dueAt: due ? due.toISOString() : null, recurrence, timezone };
}

export function formatShort(iso, locale = 'uk-UA') {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }); } catch { return iso; }
}

export function startOfLocalDayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function endOfLocalDayIso() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}
