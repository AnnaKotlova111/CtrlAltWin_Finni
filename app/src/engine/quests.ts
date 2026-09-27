/**
 * Оценка решений в заданиях.
 *
 * Контент заданий описан декларативно (content/quests.ts), здесь – правила,
 * по которым ответ превращается в оценку и награду. Новое задание не требует
 * изменений в этом модуле, если оно одного из поддерживаемых типов.
 */

import { QUEST_MOOD, QUEST_REWARD_FACTOR } from './constants';
import type { Quest } from '../content/quests';
import type { QuestGrade } from './types';

/** Ответ ребёнка. Форма зависит от типа задания. */
export type QuestAnswer =
  | { kind: 'allocate'; values: Record<string, number> }
  | { kind: 'cart'; chosen: string[] }
  | { kind: 'number'; value: number }
  | { kind: 'choice'; optionId: string }
  | { kind: 'compare'; optionId: string };

export interface QuestOutcome {
  grade: QuestGrade;
  /** Что произошло – для типов с явным последствием. */
  outcome: string | null;
  explain: string;
  nextStep: string;
  reward: number;
  moodDelta: number;
}

function gradeAllocate(quest: Quest, values: Record<string, number>): QuestGrade {
  if (quest.kind !== 'allocate') throw new Error('Несовпадение типа задания');
  const keys = Object.keys(quest.expect);
  const met = keys.filter((k) => (values[k] ?? 0) >= quest.expect[k]).length;
  const total = Object.values(values).reduce((s, v) => s + v, 0);
  // Нераспределённый остаток – это не ошибка, но и не полный ответ.
  const allSpent = total >= quest.amount;
  if (met === keys.length && allSpent) return 'good';
  if (met > 0) return 'partial';
  return 'weak';
}

function gradeCart(quest: Quest, chosen: string[]): QuestGrade {
  if (quest.kind !== 'cart') throw new Error('Несовпадение типа задания');
  const picked = new Set(chosen);
  const essentials = quest.options.filter((o) => o.essential);
  const got = essentials.filter((o) => picked.has(o.id)).length;
  const sum = quest.options
    .filter((o) => picked.has(o.id))
    .reduce((s, o) => s + o.price, 0);
  if (sum > quest.limit) return 'weak';
  if (got === essentials.length) return 'good';
  if (got >= Math.ceil(essentials.length / 2)) return 'partial';
  return 'weak';
}

function gradeNumber(quest: Quest, value: number): QuestGrade {
  if (quest.kind !== 'number') throw new Error('Несовпадение типа задания');
  if (value === quest.answer) return 'good';
  // Близкий ответ – ребёнок понял способ, но ошибся в счёте.
  const off = Math.abs(value - quest.answer) / quest.answer;
  return off <= 0.2 ? 'partial' : 'weak';
}

/** Оценивает ответ и считает награду. Повтор задания награды не приносит. */
export function gradeQuest(quest: Quest, answer: QuestAnswer, isReplay: boolean): QuestOutcome {
  let grade: QuestGrade;
  let outcome: string | null = null;

  switch (answer.kind) {
    case 'allocate':
      grade = gradeAllocate(quest, answer.values);
      break;
    case 'cart':
      grade = gradeCart(quest, answer.chosen);
      break;
    case 'number':
      grade = gradeNumber(quest, answer.value);
      break;
    case 'choice': {
      if (quest.kind !== 'choice') throw new Error('Несовпадение типа задания');
      const option = quest.options.find((o) => o.id === answer.optionId);
      if (!option) throw new Error(`Неизвестный вариант: ${answer.optionId}`);
      grade = option.grade;
      outcome = option.outcome;
      break;
    }
    case 'compare': {
      if (quest.kind !== 'compare') throw new Error('Несовпадение типа задания');
      const offer = quest.offers.find((o) => o.id === answer.optionId);
      if (!offer) throw new Error(`Неизвестный вариант: ${answer.optionId}`);
      grade = offer.grade;
      outcome = offer.outcome;
      break;
    }
  }

  return {
    grade,
    outcome,
    explain: quest.explain[grade],
    nextStep: quest.nextStep,
    reward: isReplay ? 0 : Math.round(quest.reward * QUEST_REWARD_FACTOR[grade]),
    moodDelta: isReplay ? 0 : QUEST_MOOD[grade],
  };
}

/**
 * Задание дня – одно на сутки и в первую очередь из непройденных:
 * ребёнок открывает игру и сразу видит, что можно сделать сегодня.
 * Когда пройдено всё, задание дня всё равно есть – его можно решить ещё раз.
 */
export function questOfDay<T extends { id: string }>(
  quests: T[],
  passedIds: string[],
  day: number
): T | null {
  if (quests.length === 0) return null;
  const passed = new Set(passedIds);
  const fresh = quests.filter((q) => !passed.has(q.id));
  const pool = fresh.length > 0 ? fresh : quests;
  const i = ((Math.trunc(day) % pool.length) + pool.length) % pool.length;
  return pool[i];
}

/** Номер дня по дате вида «2026-09-25»: задание меняется ровно раз в сутки. */
export function dayNumber(date: string): number {
  const ms = Date.parse(date);
  return Number.isNaN(ms) ? 0 : Math.floor(ms / 86_400_000);
}

export const GRADE_TITLES: Record<QuestGrade, string> = {
  good: 'Отличное решение',
  partial: 'Почти получилось',
  weak: 'Есть что обсудить',
};
