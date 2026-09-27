/**
 * Сверка набора иконок.
 *
 * Иконки рисует художник, а не код, поэтому важно, чтобы имена в `ICON_NAMES`
 * и готовые файлы в `public/assets/icons` совпадали. Если списки разъедутся,
 * вместо иконки в приложении будет пустое место.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { ICON_NAMES, safeIcon } from '../components/Icon';
import { PERIOD_EVENTS } from '../content/events';
import { CUSTOM_GOAL_TITLES, GOALS } from '../content/goals';
import { QUESTS } from '../content/quests';
import { SHOP } from '../content/shop';

const DIR = resolve(__dirname, '../../public/assets/icons');

const FILES = readdirSync(DIR)
  .filter((f) => f.endsWith('.webp'))
  .map((f) => f.replace('.webp', ''));

describe('иконки', () => {
  it('у каждой иконки приложения есть готовый файл', () => {
    expect(ICON_NAMES.filter((name) => !FILES.includes(name))).toEqual([]);
  });

  it('ни один файл иконки не лежит без дела', () => {
    expect(FILES.filter((name) => !ICON_NAMES.includes(name as never))).toEqual([]);
  });

  it('каждый файл иконки – настоящая картинка WebP, а не пустышка', () => {
    const broken = FILES.filter((name) => {
      const data = readFileSync(resolve(DIR, `${name}.webp`));
      const isWebp = data.subarray(0, 4).toString('latin1') === 'RIFF' && data.subarray(8, 12).toString('latin1') === 'WEBP';
      return !isWebp || data.length < 500;
    });
    expect(broken).toEqual([]);
  });

  it('каждая иконка из контента существует', () => {
    const used = [
      ...GOALS.map((g) => g.icon),
      ...CUSTOM_GOAL_TITLES.map((g) => g.icon),
      ...SHOP.map((i) => i.icon),
      ...PERIOD_EVENTS.map((e) => e.icon),
      ...QUESTS.flatMap((q) =>
        q.kind === 'allocate' ? q.buckets.map((b) => b.icon) : q.kind === 'cart' ? q.options.map((o) => o.icon) : []
      ),
    ];
    expect([...new Set(used)].filter((name) => !ICON_NAMES.includes(name as never))).toEqual([]);
  });

  it('несуществующее имя не роняет экран, а показывает звезду', () => {
    expect(safeIcon('такой-иконки-нет')).toBe('star');
    expect(safeIcon('piggy')).toBe('piggy');
  });
});
