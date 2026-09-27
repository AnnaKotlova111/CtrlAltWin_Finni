/**
 * Тесты ключевой логики: план бюджета, покупки, копилка.
 * Запуск: npm test
 */

import { describe, expect, it } from 'vitest';

import {
  allocationRest,
  allocationTotal,
  applyStats,
  canAfford,
  checkPlan,
  clampStat,
  money,
  periodsToGoal,
  periodsWord,
  statsDiff,
} from './economy';

describe('план бюджета', () => {
  const income = 300;
  const minNeeds = 20;

  it('считает остаток', () => {
    expect(allocationRest({ needs: 100, wants: 50, savings: 50 }, income)).toBe(100);
    expect(allocationTotal({ needs: 100, wants: 50, savings: 50 })).toBe(200);
  });

  it('не даёт распределить больше, чем есть', () => {
    const r = checkPlan({ needs: 200, wants: 200, savings: 0 }, income, minNeeds);
    expect(r.ok).toBe(false);
    expect(r.rest).toBe(-100);
    expect(r.problem).toContain('100');
  });

  it('требует минимум на обязательное', () => {
    const r = checkPlan({ needs: 0, wants: 100, savings: 100 }, income, minNeeds);
    expect(r.ok).toBe(false);
    expect(r.problem).toContain('обязательное');
  });

  it('принимает корректный план с остатком', () => {
    const r = checkPlan({ needs: 150, wants: 50, savings: 50 }, income, minNeeds);
    expect(r.ok).toBe(true);
    expect(r.rest).toBe(50);
    expect(r.problem).toBeNull();
  });

  it('принимает план, распределённый полностью', () => {
    const r = checkPlan({ needs: 150, wants: 100, savings: 50 }, income, minNeeds);
    expect(r.ok).toBe(true);
    expect(r.rest).toBe(0);
  });
});

describe('покупки', () => {
  it('разрешает покупку, когда денег хватает', () => {
    expect(canAfford(100, 100, 0).ok).toBe(true);
    expect(canAfford(100, 30, 0).ok).toBe(true);
  });

  it('запрещает уйти в минус и объясняет, чего не хватает', () => {
    const r = canAfford(40, 100, 0);
    expect(r.ok).toBe(false);
    expect(r.missing).toBe(60);
    expect(r.reason).toContain('60');
    expect(r.options.length).toBeGreaterThan(0);
  });

  it('предлагает копилку только если в ней хватает средств', () => {
    const poor = canAfford(40, 100, 10);
    const rich = canAfford(40, 100, 200);
    expect(poor.options.some((o) => o.includes('копилки'))).toBe(false);
    expect(rich.options.some((o) => o.includes('копилки'))).toBe(true);
  });
});

describe('показатели питомца', () => {
  it('держится в диапазоне 0…100', () => {
    expect(clampStat(-30)).toBe(0);
    expect(clampStat(140)).toBe(100);
    expect(clampStat(55.4)).toBe(55);
  });

  it('применяет изменения и не выходит за границы', () => {
    const s = applyStats({ mood: 90, fullness: 10, comfort: 50 }, { mood: 30, fullness: -30 });
    expect(s).toEqual({ mood: 100, fullness: 0, comfort: 50 });
  });

  it('показывает только изменившиеся показатели', () => {
    const d = statsDiff({ mood: 50, fullness: 50, comfort: 50 }, { mood: 60, fullness: 50, comfort: 40 });
    expect(d).toEqual({ mood: 10, comfort: -10 });
  });
});

describe('срок достижения цели', () => {
  it('без пополнений срок не показывается', () => {
    expect(periodsToGoal(500, [])).toBeNull();
  });

  it('считает по средней сумме пополнения', () => {
    // средняя 100, осталось 450 → 5 периодов (округление вверх)
    expect(periodsToGoal(450, [100, 100, 100])).toEqual({ periods: 5, average: 100 });
  });

  it('цель достигнута – срок нулевой', () => {
    expect(periodsToGoal(0, [50])).toEqual({ periods: 0, average: 0 });
  });

  it('склоняет слово «период»', () => {
    expect(periodsWord(1)).toBe('период');
    expect(periodsWord(3)).toBe('периода');
    expect(periodsWord(5)).toBe('периодов');
    expect(periodsWord(11)).toBe('периодов');
    expect(periodsWord(21)).toBe('период');
  });
});

describe('формат сумм', () => {
  it('разделяет тысячи пробелом и ставит знак валюты', () => {
    const nbsp = ' ';
    expect(money(1240)).toBe(`1${nbsp}240${nbsp}Φ`);
    expect(money(0)).toBe(`0${nbsp}Φ`);
  });

  it('пробелы внутри суммы неразрывные – строка не разъедется переносом', () => {
    expect(money(1240)).not.toMatch(/ /);
  });
});
