/**
 * Финансовые цели: то, ради чего ребёнок копит.
 *
 * Есть готовые цели с понятной стоимостью и конструктор простой цели
 * из установленного набора параметров (название + стоимость).
 */

import type { Goal } from '../engine/types';

export const GOALS: Goal[] = [
  {
    id: 'scooter',
    title: 'Самокат',
    price: 600,
    hint: 'Кататься во дворе каждый день',
    icon: 'scooter',
  },
  {
    id: 'tent',
    title: 'Домик-палатка',
    price: 450,
    hint: 'Своё укрытие прямо в комнате',
    icon: 'tent',
  },
  {
    id: 'aquapark',
    title: 'Поход в аквапарк',
    price: 800,
    hint: 'Целый день горок и воды',
    icon: 'wave',
  },
  {
    id: 'telescope',
    title: 'Телескоп',
    price: 1000,
    hint: 'Смотреть на Луну и планеты прямо из окна',
    icon: 'telescope',
  },
];

/** Заготовки для конструктора своей цели. */
export const CUSTOM_GOAL_TITLES = [
  { title: 'Новые кроссовки', icon: 'shoe' },
  { title: 'Набор для рисования', icon: 'palette' },
  { title: 'Коньки', icon: 'skate' },
  { title: 'Настольная игра', icon: 'dice' },
  { title: 'Поездка к морю', icon: 'wave' },
  { title: 'Конструктор', icon: 'blocks' },
];

/** Быстрые варианты стоимости. Можно ввести и свою – от 50 до 5000 Φ. */
export const CUSTOM_GOAL_PRICES = [300, 600, 1000, 2000];

const BY_ID = new Map(GOALS.map((g) => [g.id, g]));

export function baseGoal(id: string): Goal | undefined {
  return BY_ID.get(id);
}
