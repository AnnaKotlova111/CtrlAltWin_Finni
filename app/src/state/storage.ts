/**
 * Локальное хранилище профиля.
 *
 * Данные никуда не отправляются: всё лежит на устройстве в localStorage.
 * Персональные данные не собираются – только игровое имя и прогресс.
 */

import { MAX_ACTIVE_GOALS, PROFILE_VERSION } from '../engine/constants';
import type { Profile } from '../engine/types';

/**
 * Версия 1 знала только одну активную цель. При смене цели финкоины
 * прежней оставались в копилке, но на экране их не было видно.
 * Переводим на версию 2: все цели с накоплениями становятся активными.
 */
export function migrate(data: Record<string, unknown>): Profile | null {
  if (data.version === PROFILE_VERSION) return data as unknown as Profile;
  if (data.version !== 1) return null;

  const old = data as unknown as Profile & { activeGoalId: string | null };
  const withMoney = Object.entries(old.savedByGoal ?? {})
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
  const ids = [...new Set([...(old.activeGoalId ? [old.activeGoalId] : []), ...withMoney])];

  const { activeGoalId: _drop, ...rest } = old;
  return {
    ...rest,
    version: PROFILE_VERSION,
    activeGoalIds: ids.slice(0, MAX_ACTIVE_GOALS),
    achievedGoals: [],
  };
}

const KEY = 'finni.profile.v1';
const DAILY_KEY = 'finni.daily.v1';
const QUEST_KEY = 'finni.dailyquest.v1';

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    // Повреждённое сохранение не должно ронять приложение.
    return null;
  }
}

export function saveProfile(profile: Profile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Нет места или режим приватного просмотра – игра продолжается в памяти.
  }
}

export function clearProfile(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(DAILY_KEY);
    localStorage.removeItem(QUEST_KEY);
  } catch {
    /* игнорируем */
  }
}

/** Дата последнего ежедневного бонуса в формате ГГГГ-ММ-ДД. */
export function lastDailyBonus(): string | null {
  try {
    return localStorage.getItem(DAILY_KEY);
  } catch {
    return null;
  }
}

/**
 * Забывает дату последнего бонуса. Нужно демонстрационному режиму:
 * кнопка «Следующий день» так делает бонус снова доступным, не требуя
 * ждать настоящих суток.
 */
export function clearDailyBonus(): void {
  try {
    localStorage.removeItem(DAILY_KEY);
  } catch {
    /* игнорируем */
  }
}

export function markDailyBonus(day: string): void {
  try {
    localStorage.setItem(DAILY_KEY, day);
  } catch {
    /* игнорируем */
  }
}

/**
 * Задание дня закрепляется за календарным днём: какое задание выпало,
 * такое и остаётся до конца суток – даже после того, как ребёнок его решил.
 * Тогда на главной честно пишется «задание дня выполнено», а не подставляется
 * следующее.
 */
export function dailyQuestPin(): { date: string; id: string } | null {
  try {
    const raw = localStorage.getItem(QUEST_KEY);
    if (!raw) return null;
    const [date, id] = raw.split('|');
    return date && id ? { date, id } : null;
  } catch {
    return null;
  }
}

export function pinDailyQuest(date: string, id: string): void {
  try {
    localStorage.setItem(QUEST_KEY, `${date}|${id}`);
  } catch {
    /* игнорируем */
  }
}

/** Забывает задание дня – демонстрационному режиму нужно выдать новое. */
export function clearDailyQuest(): void {
  try {
    localStorage.removeItem(QUEST_KEY);
  } catch {
    /* игнорируем */
  }
}

/**
 * Сегодняшняя дата по местному времени. Именно местное время важно ребёнку:
 * и бонус за вход, и задание дня должны меняться в полночь на его часах.
 */
export function today(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
