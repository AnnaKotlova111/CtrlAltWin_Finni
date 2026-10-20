/**
 * Константы игровой экономики.
 *
 * Все правила расчёта собраны здесь и в соседних модулях engine/*.
 * Интерфейс не считает деньги сам – он только показывает результат.
 */

import type { PetStats, QuestGrade, Stage } from './types';

/** Стартовый бюджет первой недели. */
export const INCOME_FIRST = 300;

/** Регулярные карманные финкоины в начале каждой следующей недели. */
export const INCOME_REGULAR = 220;

/** Бонус за вход в приложение (раз в календарный день). */
export const DAILY_BONUS = 15;

/** Доля награды за задание в зависимости от качества решения.
 *  Даже неудачное решение приносит финкоины – ошибка не наказывается. */
export const QUEST_REWARD_FACTOR: Record<QuestGrade, number> = {
  good: 1,
  partial: 0.6,
  weak: 0.25,
};

/** Насколько задание поднимает настроение питомца. */
export const QUEST_MOOD: Record<QuestGrade, number> = {
  good: 6,
  partial: 3,
  weak: 1,
};

/** Сколько показателей теряется за игровую неделю (жизнь идёт). */
export const PERIOD_DECAY: PetStats = {
  fullness: 30,
  mood: 15,
  comfort: 12,
};

export const STAT_MIN = 0;
export const STAT_MAX = 100;

/** Сытость ниже этого значения означает, что обязательное не закрыто. */
export const FULLNESS_OK = 40;

/** Допустимое отклонение факта от плана – 25 %. */
export const PLAN_TOLERANCE = 0.25;

/** Очки развития за выполненные условия недели. */
export const GROWTH_POINTS = {
  needsCovered: 2,
  planFollowed: 2,
  savedAsPlanned: 2,
  questsDone: 1,
} as const;

/** Сколько заданий за неделю считается «активным участием». */
export const QUESTS_FOR_BONUS = 2;

/** Порог очков развития для каждой стадии. Стадия не понижается никогда. */
export const STAGE_THRESHOLDS: Record<Stage, number> = {
  1: 0,
  2: 8,
  3: 20,
};

/**
 * Сколько стоит оставить на еду и уход, если план ещё не составлен.
 * Это миска каши и свежая вода – самый дешёвый набор, на котором
 * питомец доживёт до конца недели.
 */
export const NEEDS_RESERVE = 50;

/** Сколько целей можно копить одновременно – больше ребёнку 7–11 лет сложно удерживать. */
export const MAX_ACTIVE_GOALS = 3;

/** Своя цель: разумные рамки стоимости и длины названия. */
export const CUSTOM_GOAL_MIN_PRICE = 50;
export const CUSTOM_GOAL_MAX_PRICE = 5000;
export const CUSTOM_GOAL_TITLE_MAX = 30;

/** Потолок одного начисления от взрослого: крупные суммы обесценили бы игру. */
export const PARENT_BONUS_MAX = 500;

/** Сколько недель воспроизводится в демонстрационном сценарии. */
export const DEMO_PERIODS = 5;

/** Знак игровой валюты. */
export const CURRENCY = 'Φ';

/** Версия структуры профиля – для миграции сохранений. */
export const PROFILE_VERSION = 2;
