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
    'Отложить эту покупку на следующий период',
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
 * Примерный срок достижения цели в игровых периодах.
 * Считается по средней сумме регулярного пополнения – как требует ТЗ 2.5.7.
 * Если пополнений ещё не было, срок не показывается.
 */
export function periodsToGoal(
  remaining: number,
  contributions: number[]
): { periods: number; average: number } | null {
  if (remaining <= 0) return { periods: 0, average: 0 };
  if (contributions.length === 0) return null;
  const average = contributions.reduce((s, c) => s + c, 0) / contributions.length;
  if (average <= 0) return null;
  return { periods: Math.ceil(remaining / average), average: Math.round(average) };
}

/** Русское склонение слова «период». */
export function periodsWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'период';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'периода';
  return 'периодов';
}
