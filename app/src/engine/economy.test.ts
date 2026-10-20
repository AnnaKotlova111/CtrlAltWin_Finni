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
  savingsForecast,
  needsReserve,
  suggestedPace,
  weeksAfter,
  weeksWord,
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
  const periods = (...amounts: number[]) =>
    amounts.map((amount, i) => ({ period: i + 1, amount }));

  it('без пополнений срок не считается', () => {
    // Выдумывать темп за ребёнка нельзя: цифра выглядела бы настоящей.
    expect(savingsForecast(500, [])).toBeNull();
  });

  it('цель накоплена – прогноз не нужен', () => {
    expect(savingsForecast(0, periods(50))).toBeNull();
  });

  it('ровный темп: срок считается по нему', () => {
    const f = savingsForecast(450, periods(100, 100, 100))!;
    expect(f.pace).toBe(100);
    expect(f.periods).toBe(5);
  });

  it('давний крупный взнос не выдаётся за нынешний темп', () => {
    // Откладывали по 10, потом один раз 60, а последние две недели – по 2.
    const f = savingsForecast(520, periods(10, 10, 60, 2, 2))!;
    expect(f.pace).toBe(2);
  });

  it('пропущенная неделя считается нулём, темп падает', () => {
    const f = savingsForecast(200, [
      { period: 1, amount: 50 },
      { period: 4, amount: 10 },
    ])!;
    expect(f.pace).toBe(5);
  });

  it('одно пополнение – прогноз всё равно даётся', () => {
    const f = savingsForecast(300, periods(50))!;
    expect(f.periodsFilled).toBe(1);
    expect(f.periods).toBe(6);
  });

  it('подсказка: сумма, с которой цель близка, но посильна', () => {
    // 600 Φ за десять недель – по 60 Φ, это меньше половины карманных.
    expect(suggestedPace(600, 220)).toBe(60);
    // Дорогая цель: больше половины карманных советовать нельзя.
    expect(suggestedPace(3000, 220)).toBe(110);
    // Близкая цель: совет не опускается ниже десятки.
    expect(suggestedPace(30, 220)).toBe(10);
  });

  it('резерв на обязательное: по плану, а без плана – минимальный набор еды', () => {
    // План на 120 Φ, куплено на 40 – оставить нужно 80.
    expect(needsReserve({ needs: 120 }, 40, 50)).toBe(80);
    // Обязательное уже закрыто – оставлять нечего.
    expect(needsReserve({ needs: 120 }, 150, 50)).toBe(0);
    // Плана нет – минимальный набор: каша и вода.
    expect(needsReserve(null, 0, 50)).toBe(50);
  });

  it('склоняет слово «неделя»', () => {
    expect(weeksWord(1)).toBe('неделя');
    expect(weeksWord(3)).toBe('недели');
    expect(weeksWord(5)).toBe('недель');
    expect(weeksWord(11)).toBe('недель');
    expect(weeksWord(21)).toBe('неделя');
  });

  it('после «через» единица стоит в другой форме', () => {
    // «1 неделя», но «через 1 неделю» – расходятся только на единице.
    expect(weeksAfter(1)).toBe('неделю');
    expect(weeksAfter(21)).toBe('неделю');
    expect(weeksAfter(3)).toBe('недели');
    expect(weeksAfter(5)).toBe('недель');
    expect(weeksAfter(11)).toBe('недель');
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
