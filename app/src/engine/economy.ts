/**
 * Правила игровой экономики: план бюджета, покупки, копилка.
 *
 * Все функции чистые: получают данные, возвращают результат или причину
 * отказа. Ничего не мутируют и ничего не знают про интерфейс.
 */

import { CURRENCY, STAT_MAX, STAT_MIN } from './constants';
import type { Allocation, Direction, PetStats } from './types';

export const DIRECTIONS: Direction[] = ['needs', 'wants', 'savings'];

export const DIRECTION_TITLES: Record<Direction, string> = {
  needs: 'Обязательное',
  wants: 'Желаемое',
  savings: 'В копилку',
};

export const DIRECTION_HINTS: Record<Direction, string> = {
  needs: 'Еда и уход за питомцем',
  wants: 'Игрушки и красивые мелочи',
  savings: 'Откладываем на цель',
};

/** Неразрывный пробел, который ru-RU подставляет между разрядами. */
const NBSP = /\u00A0/g;

/** Форматирует сумму так, как её читает ребёнок: «1 240 Φ». */
/**
 * Сумма со знаком валюты. Все пробелы внутри – неразрывные: «300 Φ» и
 * «1 240 Φ» не должны разрываться переносом строки.
 */
export function money(amount: number): string {
  const n = Math.round(amount);
  const nbsp = ' ';
  return `${n.toLocaleString('ru-RU').replace(NBSP, nbsp)}${nbsp}${CURRENCY}`;
}

export function emptyAllocation(): Allocation {
  return { needs: 0, wants: 0, savings: 0 };
}

export function allocationTotal(a: Allocation): number {
  return a.needs + a.wants + a.savings;
}

/** Сколько ещё не распределено. Может быть только ≥ 0: перерасход не даём. */
export function allocationRest(a: Allocation, income: number): number {
  return income - allocationTotal(a);
}

export interface PlanCheck {
  ok: boolean;
  rest: number;
  /** Причина, по которой план нельзя подтвердить. */
  problem: string | null;
  /** Подсказка, что можно сделать. */
  advice: string | null;
}

/**
 * Проверяет план перед подтверждением.
 * Сумма распределения не должна превышать доступный бюджет,
 * и хотя бы что-то должно быть направлено на обязательное.
 */
export function checkPlan(plan: Allocation, income: number, minNeeds: number): PlanCheck {
  const rest = allocationRest(plan, income);
  if (rest < 0) {
    return {
      ok: false,
      rest,
      problem: `Распределено больше, чем есть: не хватает ${money(-rest)}`,
      advice: 'Уменьши любое направление – проще всего «Желаемое»',
    };
  }
  if (plan.needs < minNeeds) {
    return {
      ok: false,
      rest,
      problem: `На обязательное нужно хотя бы ${money(minNeeds)}`,
      advice: 'Самая дешёвая обязательная покупка стоит столько же – без неё питомец останется голодным',
    };
  }
  return { ok: true, rest, problem: null, advice: null };
}

export interface AffordCheck {
  ok: boolean;
  /** Сколько не хватает. */
  missing: number;
  reason: string | null;
  options: string[];
}

/**
 * Можно ли совершить покупку. Отрицательный баланс не допускается:
 * вместо отказа без объяснения приложение говорит, чего не хватает
 * и какие есть варианты.
 */
export function canAfford(balance: number, price: number, savings: number): AffordCheck {
  if (price <= balance) {
    return { ok: true, missing: 0, reason: null, options: [] };
  }
  const missing = price - balance;
  const options = [
    'Выбрать что-нибудь подешевле',
    'Отложить эту покупку на следующую неделю',
    'Выполнить задание и получить финкоины',
  ];
  if (savings >= missing) {
    options.push('Снять часть из копилки – но цель станет дальше');
  }
  return {
    ok: false,
    missing,
    reason: `Не хватает ${money(missing)}`,
    options,
  };
}

/** Ограничивает показатель диапазоном 0…100. */
export function clampStat(value: number): number {
  return Math.max(STAT_MIN, Math.min(STAT_MAX, Math.round(value)));
}

/** Применяет изменения к показателям питомца. */
export function applyStats(stats: PetStats, delta: Partial<PetStats>): PetStats {
  return {
    mood: clampStat(stats.mood + (delta.mood ?? 0)),
    fullness: clampStat(stats.fullness + (delta.fullness ?? 0)),
    comfort: clampStat(stats.comfort + (delta.comfort ?? 0)),
  };
}

/** Разница между двумя наборами показателей – для экрана «что изменилось». */
export function statsDiff(before: PetStats, after: PetStats): Partial<PetStats> {
  const d: Partial<PetStats> = {};
  if (after.mood !== before.mood) d.mood = after.mood - before.mood;
  if (after.fullness !== before.fullness) d.fullness = after.fullness - before.fullness;
  if (after.comfort !== before.comfort) d.comfort = after.comfort - before.comfort;
  return d;
}

/**
 * Примерный срок достижения цели в игровых неделях.
 * Считается по средней сумме регулярного пополнения – как требует ТЗ 2.5.7.
 * Если пополнений ещё не было, срок не показывается.
 */
/** По скольким последним неделям считается нынешний темп. */
const RECENT_PERIODS = 2;

/** За столько недель цель считается достижимой «на глаз». */
const COMFORTABLE_PERIODS = 10;

/** Больше этого срока числа ребёнку уже ничего не говорят. */
export const FAR_AWAY_PERIODS = 24;

export interface SavingsForecast {
  /** Сколько уходит в копилку за неделю сейчас. */
  pace: number;
  /** Сколько недель до цели при нынешнем темпе. */
  periods: number;
  /** В скольких неделях копилку вообще пополняли. */
  periodsFilled: number;
}

/**
 * Прогноз накопления по тому, сколько ребёнок откладывает на самом деле.
 *
 * Темп – это две последние недели, считая от последнего пополнения.
 * Окно короткое нарочно: при трёх неделях один давний крупный взнос
 * перевешивал свежие маленькие, и игра сообщала, что темп вырос, когда он упал.
 * Недели без пополнений внутри окна считаются нулями: пропустил неделю –
 * темп упал, и срок честно вырос.
 *
 * Пока пополнений не было, прогноза нет: придумывать темп за ребёнка нечестно.
 */
export function savingsForecast(
  remaining: number,
  byPeriod: { period: number; amount: number }[]
): SavingsForecast | null {
  if (remaining <= 0) return null;
  const filled = byPeriod.filter((p) => p.amount > 0);
  if (filled.length === 0) return null;

  const first = filled[0].period;
  const last = filled[filled.length - 1].period;
  const windowFrom = Math.max(first, last - (RECENT_PERIODS - 1));
  const sum = byPeriod
    .filter((p) => p.period >= windowFrom && p.period <= last)
    .reduce((total, p) => total + p.amount, 0);

  const pace = Math.round(sum / (last - windowFrom + 1));
  if (pace <= 0) return null;

  return { pace, periods: Math.ceil(remaining / pace), periodsFilled: filled.length };
}

/**
 * Сколько стоит откладывать, чтобы цель не висела годами.
 *
 * Считается от самой цели: такая сумма, при которой до неё остаётся около
 * десяти недель. Но не больше половины карманных за неделю – иначе совет
 * невыполним, а невыполнимый совет хуже, чем никакого. Округляем до десятка:
 * «по 60 Φ» запоминается, «по 57 Φ» – нет.
 */
export function suggestedPace(remaining: number, incomePerPeriod: number): number {
  const needed = Math.ceil(remaining / COMFORTABLE_PERIODS / 10) * 10;
  const affordable = Math.floor(incomePerPeriod / 2 / 10) * 10;
  return Math.max(10, Math.min(needed, affordable));
}

/**
 * Сколько финкоинов нужно оставить на обязательное на этой неделе.
 *
 * Если план составлен, считаем по нему: сколько обязательного ещё не куплено.
 * Если плана нет, берём минимальный набор еды – иначе игра молчала бы,
 * пока ребёнок уносит в копилку всё до копейки.
 */
export function needsReserve(
  plan: { needs: number } | null,
  factNeeds: number,
  fallback: number
): number {
  if (!plan) return fallback;
  return Math.max(0, plan.needs - factNeeds);
}

/** Русское склонение слова «неделя». */
export function weeksWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'неделя';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'недели';
  return 'недель';
}

/**
 * Форма после «через» и «за»: через неделю, через 2 недели, через 5 недель.
 *
 * Отдельно от `weeksWord`, потому что сама по себе это «1 неделя», а после
 * предлога – «через 1 неделю». Расходятся только на единице.
 */
export function weeksAfter(n: number): string {
  return n % 10 === 1 && n % 100 !== 11 ? 'неделю' : weeksWord(n);
}
