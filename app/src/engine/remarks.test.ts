/**
 * Тесты реплик питомцев: приветствия, реплики в заданиях и в плане бюджета.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { SPECIES } from '../content/pets';
import { QUESTS } from '../content/quests';
import {
  ALMOST_SHARE,
  BUDGET_LINES,
  BUDGET_NOTES,
  NEEDS_SHARE_MIN,
  SAVINGS_LINES,
  SAVINGS_NOTES,
  SHOP_LINES,
  SHOP_NOTES,
  budgetMood,
  questRemark,
  savingsMood,
  shopMood,
  type BudgetMood,
  type SavingsMood,
  type ShopMood,
} from '../content/remarks';
import { drawGreeting, type GreetingBag } from '../state/greeting';

/** Предсказуемый генератор случайных чисел для воспроизводимых тестов. */
function seeded(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

describe('приветствия на главном экране', () => {
  it('у каждого питомца не меньше 12 разных фраз', () => {
    for (const s of SPECIES) {
      expect(s.phrases.greet.length, s.name).toBeGreaterThanOrEqual(12);
      expect(new Set(s.phrases.greet).size, `${s.name}: повторы`).toBe(s.phrases.greet.length);
    }
  });

  it('за один круг звучат все фразы, и ни одна не повторяется', () => {
    const size = 15;
    const rand = seeded(7);
    let bag: GreetingBag | null = null;
    const seen: number[] = [];
    for (let i = 0; i < size; i++) {
      const r = drawGreeting(bag, 'finni', size, rand);
      seen.push(r.index);
      bag = r.bag;
    }
    expect(new Set(seen).size).toBe(size);
  });

  it('две одинаковые фразы подряд не выпадают даже на стыке кругов', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rand = seeded(seed);
      let bag: GreetingBag | null = null;
      let prev: number | null = null;
      for (let i = 0; i < 45; i++) {
        const r = drawGreeting(bag, 'kashik', 15, rand);
        expect(r.index).not.toBe(prev);
        prev = r.index;
        bag = r.bag;
      }
    }
  });

  it('при смене питомца начинается новый круг', () => {
    const first = drawGreeting(null, 'finni', 15, seeded(3));
    const other = drawGreeting(first.bag, 'lucky', 15, seeded(3));
    expect(other.bag.species).toBe('lucky');
    expect(other.bag.queue).toHaveLength(14);
  });
});

describe('реплики питомцев в заданиях', () => {
  it('у каждого питомца есть реплика и подсказка к каждому заданию', () => {
    for (const q of QUESTS) {
      for (const s of SPECIES) {
        const r = questRemark(q.id, s.id);
        expect(r, `${q.id} / ${s.name}`).not.toBeNull();
        expect(r!.says.length, `${q.id} / ${s.name}: реплика`).toBeGreaterThan(10);
        expect(r!.note.length, `${q.id} / ${s.name}: подсказка`).toBeGreaterThan(20);
      }
    }
  });

  it('в одном задании у разных питомцев разные реплики', () => {
    for (const q of QUESTS) {
      const lines = SPECIES.map((s) => questRemark(q.id, s.id)!.says);
      expect(new Set(lines).size, q.id).toBe(SPECIES.length);
    }
  });

  it('для неизвестного задания реплики нет – блок просто не показывается', () => {
    expect(questRemark('нет-такого', 'finni')).toBeNull();
  });
});

describe('реплики питомца в плане бюджета', () => {
  const income = 300;

  it('пустой план – начало', () => {
    expect(budgetMood({ needs: 0, wants: 0, savings: 0 }, income)).toBe('start');
  });

  it('мало на обязательное – предупреждение про еду', () => {
    expect(budgetMood({ needs: income * NEEDS_SHARE_MIN - 10, wants: 50, savings: 50 }, income)).toBe('needsLow');
  });

  it('желаемого больше, чем обязательного', () => {
    expect(budgetMood({ needs: 100, wants: 150, savings: 50 }, income)).toBe('wantsHeavy');
  });

  it('ничего в копилку', () => {
    expect(budgetMood({ needs: 150, wants: 100, savings: 0 }, income)).toBe('noSavings');
  });

  it('сбалансированный план', () => {
    expect(budgetMood({ needs: 150, wants: 80, savings: 70 }, income)).toBe('good');
  });

  it('на каждое состояние есть подсказка и реплика каждого питомца', () => {
    const moods: BudgetMood[] = ['start', 'needsLow', 'wantsHeavy', 'noSavings', 'good'];
    for (const m of moods) {
      expect(BUDGET_NOTES[m].length).toBeGreaterThan(20);
      for (const s of SPECIES) {
        expect(BUDGET_LINES[m][s.id]?.length, `${m} / ${s.name}`).toBeGreaterThan(10);
      }
    }
  });
});

describe('реплики питомца в лавке', () => {
  const base = { balance: 200, cheapestPrice: 20, planConfirmed: true, boughtNeeds: true, wantsLeft: 50 };

  it('финкоинов не хватает даже на самое дешёвое', () => {
    expect(shopMood({ ...base, balance: 10 })).toBe('lowBalance');
  });

  it('плана ещё нет – питомец предлагает начать с него', () => {
    expect(shopMood({ ...base, planConfirmed: false, wantsLeft: null })).toBe('noPlan');
  });

  it('обязательное ещё не куплено', () => {
    expect(shopMood({ ...base, boughtNeeds: false })).toBe('needsFirst');
  });

  it('деньги на желаемое по плану закончились', () => {
    expect(shopMood({ ...base, wantsLeft: 0 })).toBe('wantsOver');
    expect(shopMood({ ...base, wantsLeft: -30 })).toBe('wantsOver');
  });

  it('всё в порядке', () => {
    expect(shopMood(base)).toBe('ok');
  });

  it('на каждое состояние есть подсказка и реплика каждого питомца', () => {
    const moods: ShopMood[] = ['lowBalance', 'noPlan', 'needsFirst', 'wantsOver', 'ok'];
    for (const m of moods) {
      expect(SHOP_NOTES[m].length).toBeGreaterThan(20);
      for (const sp of SPECIES) {
        expect(SHOP_LINES[m][sp.id]?.length, `${m} / ${sp.name}`).toBeGreaterThan(10);
      }
    }
  });
});

describe('реплики питомца у копилки', () => {
  it('состояние зависит от целей и накопленного', () => {
    expect(savingsMood([])).toBe('noGoal');
    expect(savingsMood([{ price: 600, saved: 0 }])).toBe('empty');
    expect(savingsMood([{ price: 600, saved: 100 }])).toBe('progress');
    expect(savingsMood([{ price: 600, saved: 600 * ALMOST_SHARE }])).toBe('almost');
    expect(savingsMood([{ price: 600, saved: 600 }])).toBe('reached');
  });

  it('при нескольких целях радуемся самой близкой', () => {
    expect(savingsMood([{ price: 600, saved: 0 }, { price: 450, saved: 0 }])).toBe('empty');
    expect(savingsMood([{ price: 600, saved: 50 }, { price: 450, saved: 0 }])).toBe('progress');
    expect(savingsMood([{ price: 600, saved: 50 }, { price: 450, saved: 300 }])).toBe('almost');
    expect(savingsMood([{ price: 600, saved: 50 }, { price: 450, saved: 450 }])).toBe('reached');
  });

  it('на каждое состояние есть подсказка и реплика каждого питомца', () => {
    const moods: SavingsMood[] = ['noGoal', 'empty', 'progress', 'almost', 'reached'];
    for (const m of moods) {
      expect(SAVINGS_NOTES[m].length).toBeGreaterThan(20);
      for (const sp of SPECIES) {
        expect(SAVINGS_LINES[m][sp.id]?.length, `${m} / ${sp.name}`).toBeGreaterThan(10);
      }
    }
  });
});

describe('реплики о покупках и целях не угадывают род предмета', () => {
  /*
   * Покупка может быть тортом, мячиком или шапочкой, цель – самокатом или
   * палаткой. Если питомец скажет «посмотри на неё» про торт, это ошибка.
   * Поэтому в таких репликах не должно быть местоимений он/она/оно и их форм.
   */
  const PRONOUN = /(?<![а-яё])(он|она|оно|его|её|ее|него|неё|нее|ним|ней|нём|нем|им|ей)(?![а-яё])/iu;

  it('ни одна такая реплика не содержит он/она/оно', () => {
    const lines: string[] = [];
    for (const sp of SPECIES) {
      const ph = sp.phrases;
      lines.push(...ph.buyWant, ...ph.buyNeed, ...ph.goalReached, ...ph.save, ...ph.noMoney);
      for (const m of Object.keys(SHOP_LINES) as ShopMood[]) lines.push(SHOP_LINES[m][sp.id]);
      for (const m of Object.keys(SAVINGS_LINES) as SavingsMood[]) lines.push(SAVINGS_LINES[m][sp.id]);
    }
    const bad = lines.filter((l) => PRONOUN.test(l));
    expect(bad).toEqual([]);
  });
});

describe('тексты для ребёнка не угадывают его пол', () => {
  /*
   * Мы не знаем, мальчик играет или девочка, поэтому нигде нельзя написать
   * «ты накопил» или «ты накопила». Правильно – настоящее время или
   * безличная форма: «ты копишь», «отложить 70 Φ».
   *
   * Проверяем исходники контента и экранов целиком: так правило работает
   * и для текстов, которые появятся позже.
   */
  const FILES = [
    ...readdirSync(resolve(__dirname, '../content')).map((f) => `../content/${f}`),
    ...readdirSync(resolve(__dirname, '../screens')).map((f) => `../screens/${f}`),
    ...readdirSync(resolve(__dirname, '../components')).map((f) => `../components/${f}`),
  ].filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));

  /*
   * «ты» и следом – глагол в прошедшем времени или краткое прилагательное.
   * Между ними может стоять до трёх слов, в том числе через дефис:
   * «ты ничего не потерял», «ты всё-таки оставил», «ты уложился».
   */
  const GENDERED =
    /(?<![а-яё])ты\s+(?:[а-яё-]+\s+){0,3}?(?:[а-яё]+[аяиеуыёо]л(?:а|ся|ась)?|помог|помогла|смог|смогла|нашёл|нашла|пошёл|пошла|сам|сама|готов|готова|рад|рада|уверен|уверена|должен|должна)(?![а-яё])/giu;

  it('нигде нет «ты сделал» и «ты сделала»', () => {
    const bad: string[] = [];
    for (const file of FILES) {
      const text = readFileSync(resolve(__dirname, file), 'utf8');
      for (const m of text.matchAll(GENDERED)) bad.push(`${file}: ${m[0]}`);
    }
    expect(bad).toEqual([]);
  });
});
