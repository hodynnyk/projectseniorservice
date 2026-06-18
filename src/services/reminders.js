import { dueReminderItems, updateItem } from '../modules/items.js';
import { listUsers } from './auth.js';
import { notifyUser } from '../telegram/bot.js';
import { nowIso } from '../utils/dates.js';
import { logActivity } from './activity.js';

export async function runReminderSweep(env) {
  const due = await dueReminderItems(env);
  const users = await listUsers(env);
  const results = [];
  for (const item of due.slice(0, 30)) {
    const owner = users.find(u => u.id === item.owner) || users.find(u => u.role === 'owner');
    if (!owner) continue;
    const message = `⏰ ${item.title}${item.content && item.content !== item.title ? '\n' + item.content.slice(0, 500) : ''}`;
    const sent = await notifyUser(env, owner.id, message);
    item.metadata = { ...(item.metadata || {}), lastNotifiedAt: nowIso(), notifyResult: sent.ok ? 'sent' : 'skipped' };
    await updateItem(env, { ...owner, role: 'owner' }, item.id, { metadata: item.metadata }, 'scheduled');
    await logActivity(env, { userId: owner.id, source: 'scheduled', module: 'reminders', action: 'sweep_notify', objectId: item.id, message: item.title, metadata: sent });
    results.push({ itemId: item.id, sent });
  }
  return { checked: due.length, processed: results.length, results };
}
