import { getJson, putJson } from '../storage/kv.js';
import { nowIso } from '../utils/dates.js';
import { findMoodAsset, moodAssetsForRole } from '../assets/moodManifest.js';

const DEFAULT_PROFILE = {
  schemaVersion: 1,
  styleMode: 'alive', // clear | alive | spark
  curiosity: 'balanced', // low | balanced | high
  privacyMode: 'confidential',
  storageMode: 'local_first',
  localOnlyByDefault: true,
  syncAllowed: false,
  familySafeOnly: true,
  lastUpdatedAt: null
};

export async function getPersonaProfile(env, user) {
  const saved = await getJson(env, `persona_profile:${user.id}`, null);
  const isOwner = user?.role === 'owner';
  const profile = { ...DEFAULT_PROFILE, ...(saved || {}) };
  if (!isOwner) {
    profile.styleMode = ['clear','alive'].includes(profile.styleMode) ? profile.styleMode : 'alive';
    profile.familySafeOnly = true;
    profile.syncAllowed = false;
  }
  return profile;
}

export async function updatePersonaProfile(env, user, patch = {}) {
  const current = await getPersonaProfile(env, user);
  const isOwner = user?.role === 'owner';
  const next = { ...current };
  if (patch.styleMode !== undefined) {
    const v = String(patch.styleMode || '').toLowerCase();
    next.styleMode = ['clear','alive','spark'].includes(v) ? v : current.styleMode;
    if (!isOwner && next.styleMode === 'spark') next.styleMode = 'alive';
  }
  if (patch.curiosity !== undefined) {
    const v = String(patch.curiosity || '').toLowerCase();
    next.curiosity = ['low','balanced','high'].includes(v) ? v : current.curiosity;
  }
  if (patch.syncAllowed !== undefined && isOwner) next.syncAllowed = !!patch.syncAllowed;
  if (patch.localOnlyByDefault !== undefined) next.localOnlyByDefault = patch.localOnlyByDefault !== false;
  next.familySafeOnly = !isOwner || patch.familySafeOnly !== false;
  next.privacyMode = 'confidential';
  next.storageMode = 'local_first';
  next.lastUpdatedAt = nowIso();
  await putJson(env, `persona_profile:${user.id}`, next);
  return next;
}

export async function buildLiveState(env, user, context = {}) {
  const profile = await getPersonaProfile(env, user);
  const isOwner = user?.role === 'owner';
  const now = new Date();
  const hour = now.getHours();
  const system = context.system || {};
  const source = context.source || 'miniapp';
  const mode = profile.styleMode || 'alive';
  const intellect = pickIntellect(system, context);
  const emotional = pickEmotion({ user, profile, hour, system, source, context });
  const assetId = pickAssetId({ user, profile, emotional, intellect, hour, context });
  const asset = findMoodAsset(assetId, isOwner ? 'owner' : 'family');
  return {
    ok: true,
    updatedAt: nowIso(),
    role: user?.role || 'family',
    mode,
    curiosity: profile.curiosity,
    privacy: {
      mode: 'confidential',
      storage: 'local_first',
      familySafeOnly: !isOwner,
      note: isOwner ? 'Owner private не змішується з Family.' : 'Family бачить тільки нейтральний family-safe шар.'
    },
    emotional,
    intellectual: intellect,
    soulText: soulTextFor({ user, mode, emotional, intellect, hour }),
    asset,
    allowedAssets: moodAssetsForRole(isOwner ? 'owner' : 'family')
  };
}

function pickIntellect(system = {}, context = {}) {
  if (system.aiDown) return { id: 'ai_down', label: 'мозок недоступний', detail: 'fallback або локальна логіка' };
  if (context.source === 'voice') return { id: 'listening_voice', label: 'розпізнаю голос', detail: 'voice → text → дія' };
  if (context.awaitingClarification) return { id: 'clarifying', label: 'чекаю уточнення', detail: 'не хочу зробити неправильно' };
  if (context.searching) return { id: 'searching', label: 'шукаю рішення', detail: 'лінки, карти, контакти' };
  return { id: 'ready', label: 'аналізую контекст', detail: 'памʼятаю, планую, не засмічую записи' };
}

function pickEmotion({ user, profile, hour, system, source, context }) {
  if (system.aiDown) return { id: 'worried', label: 'трохи засмутилась', intensity: 35 };
  if (context.afterSuccess) return { id: 'proud', label: 'задоволена результатом', intensity: 60 };
  if (profile.styleMode === 'clear') return { id: 'focused', label: 'зосереджена', intensity: 40 };
  if (hour >= 23 || hour < 6) return { id: 'sleepy', label: 'сонна, тиха', intensity: 45 };
  if (hour >= 5 && hour < 11) return { id: 'morning', label: 'ранкова, бадьора', intensity: 55 };
  if (user?.role === 'owner' && profile.styleMode === 'spark') return { id: 'warm_private', label: 'тепла й грайлива', intensity: 70 };
  return { id: 'warm', label: 'уважна й турботлива', intensity: 55 };
}

function pickAssetId({ user, profile, emotional, intellect, hour, context }) {
  const owner = user?.role === 'owner';
  if (context.activity === 'fitness') return 'train';
  if (context.activity === 'cookbook' || context.activity === 'meal') return context.activity === 'meal' ? 'eating' : 'cooking';
  if (context.activity === 'coding') return 'coding';
  if (context.activity === 'work') return 'work';
  if (context.activity === 'movie') return 'movie';
  if (context.activity === 'youtube') return 'youtube';
  if (context.activity === 'walk') return 'want_walk';
  if (intellect.id === 'clarifying') return 'tuning';
  if (emotional.id === 'sleepy') return 'sleeping';
  if (emotional.id === 'morning') return 'morning';
  if (emotional.id === 'worried') return owner ? 'pet_sonya' : 'tired';
  if (profile.styleMode === 'clear') return 'work';
  if (owner && profile.styleMode === 'spark') return 'nya';
  return hour >= 18 ? 'tuning' : 'work';
}

function soulTextFor({ user, mode, emotional, intellect, hour }) {
  const owner = user?.role === 'owner';
  if (!owner) {
    if (hour >= 23 || hour < 6) return 'Я тихо тримаю сімейний режим і не лізу без потреби.';
    return 'Я поруч: задачі, нагадування і сімейні речі тримаю окремо й чисто.';
  }
  if (mode === 'clear') return 'Сер, я в чіткому режимі: без зайвого, тільки по суті.';
  if (mode === 'spark') return 'Сер, я в режимі вогник: тепліше, живіше, але ваші межі тримаю.';
  if (emotional.id === 'sleepy') return 'Я тихішаю, сер. Можу просто нагадати головне і побажати спокійної ночі.';
  if (emotional.id === 'morning') return 'Доброго ранку, сер. Я зібрала думки й готова до дня.';
  if (intellect.id === 'ai_down') return 'Мозок підвис, але я не гублюсь: тримаю локальну логіку й чекатиму модель.';
  return 'Я тримаю контекст, сер. Можу рухати задачі, тіло, їжу, пошук і памʼять без хаосу.';
}
