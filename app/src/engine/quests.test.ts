/**
 * Тесты оценки заданий и целостности учебного контента.
 */

import { describe, expect, it } from 'vitest';

import { COMPETENCIES, competency } from '../content/competencies';
import { GLOSSARY } from '../content/glossary';
import { CUSTOM_GOAL_TITLES, GOALS } from '../content/goals';
import { APPEARANCE_COMBINATIONS, SPECIES } from '../content/pets';
import { PERIOD_EVENTS } from '../content/events';
import { QUESTS, THEMES } from '../content/quests';
import {
  BUDGET_LINES,
  BUDGET_NOTES,
  QUEST_REMARKS,
  SAVINGS_LINES,
  SAVINGS_NOTES,
  SHOP_LINES,
  SHOP_NOTES,
} from '../content/remarks';
import { SHOP } from '../content/shop';
import { DEMO_PERIODS } from './constants';
import { dayNumber, gradeQuest, questOfDay } from './quests';

const q = (id: string) => QUESTS.find((x) => x.id === id)!;

/** Все тексты контента одним списком – для проверок на аккуратность строк. */
const ALL_CONTENT = [
  QUESTS,
  SHOP,
  GOALS,
  CUSTOM_GOAL_TITLES,
  GLOSSARY,
  PERIOD_EVENTS,
  QUEST_REMARKS,
  BUDGET_LINES,
  BUDGET_NOTES,
  SHOP_LINES,
  SHOP_NOTES,
  SAVINGS_LINES,
  SAVINGS_NOTES,
];

function contentStrings(value: unknown = ALL_CONTENT, out: string[] = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) contentStrings(v, out);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) contentStrings(v, out);
  return out;
}

describe('оценка заданий', () => {
  it('распределение: все условия выполнены – отлично', () => {
    const r = gradeQuest(q('budget-week'), { kind: 'allocate', values: { needs: 100, wants: 60, savings: 40 } }, false);
    expect(r.grade).toBe('good');
    expect(r.reward).toBeGreaterThan(0);
  });

  it('распределение: выполнено частично', () => {
    const r = gradeQuest(q('budget-week'), { kind: 'allocate', values: { needs: 120, wants: 80, savings: 0 } }, false);
    expect(r.grade).toBe('partial');
  });

  it('распределение: обязательное без денег – слабое решение, но награда есть', () => {
    const r = gradeQuest(q('budget-week'), { kind: 'allocate', values: { needs: 0, wants: 200, savings: 0 } }, false);
    expect(r.grade).toBe('weak');
    expect(r.reward).toBeGreaterThan(0);
    expect(r.explain.length).toBeGreaterThan(0);
  });

  it('корзина: все обязательные в пределах лимита', () => {
    const r = gradeQuest(q('budget-list'), { kind: 'cart', chosen: ['bowl', 'water', 'brush', 'ball'] }, false);
    expect(r.grade).toBe('good');
  });

  it('корзина: превышение лимита – слабое решение', () => {
    const r = gradeQuest(q('budget-list'), { kind: 'cart', chosen: ['bowl', 'water', 'brush', 'cake'] }, false);
    expect(r.grade).toBe('weak');
  });

  it('число: точный ответ, близкий ответ и мимо', () => {
    expect(gradeQuest(q('save-plan'), { kind: 'number', value: 100 }, false).grade).toBe('good');
    expect(gradeQuest(q('save-plan'), { kind: 'number', value: 115 }, false).grade).toBe('partial');
    expect(gradeQuest(q('save-plan'), { kind: 'number', value: 50 }, false).grade).toBe('weak');
  });

  it('выбор: оценка и последствие берутся из варианта', () => {
    const r = gradeQuest(q('save-wait'), { kind: 'choice', optionId: 'wait' }, false);
    expect(r.grade).toBe('good');
    expect(r.outcome).toBeTruthy();
  });

  it('сравнение: дешевле без скидки – правильный ответ', () => {
    expect(gradeQuest(q('pay-discount'), { kind: 'compare', optionId: 'plain' }, false).grade).toBe('good');
    expect(gradeQuest(q('pay-discount'), { kind: 'compare', optionId: 'sale' }, false).grade).toBe('weak');
  });

  it('повтор задания не приносит награды', () => {
    const r = gradeQuest(q('save-plan'), { kind: 'number', value: 100 }, true);
    expect(r.grade).toBe('good');
    expect(r.reward).toBe(0);
    expect(r.moodDelta).toBe(0);
  });

  it('объяснение выдаётся при любом результате', () => {
    for (const quest of QUESTS) {
      expect(quest.explain.good.length).toBeGreaterThan(10);
      expect(quest.explain.partial.length).toBeGreaterThan(10);
      expect(quest.explain.weak.length).toBeGreaterThan(10);
      expect(quest.nextStep.length).toBeGreaterThan(10);
    }
  });
});

describe('минимальный объём демонстрационного контента (ТЗ 2.6)', () => {
  it('не менее 9 визуально различимых комбинаций питомца', () => {
    expect(APPEARANCE_COMBINATIONS).toBeGreaterThanOrEqual(9);
  });

  it('у каждого питомца 3 стадии развития', () => {
    for (const s of SPECIES) expect(s.stageNames).toHaveLength(3);
  });

  it('не менее 5 игровых недель в демонстрационном режиме', () => {
    expect(DEMO_PERIODS).toBeGreaterThanOrEqual(5);
  });

  it('не менее 6 заданий по 3 темам', () => {
    expect(QUESTS.length).toBeGreaterThanOrEqual(6);
    for (const t of THEMES) {
      expect(QUESTS.filter((x) => x.theme === t).length).toBeGreaterThan(0);
    }
    expect(THEMES).toHaveLength(3);
  });

  it('не менее 8 позиций покупок двух типов', () => {
    expect(SHOP.length).toBeGreaterThanOrEqual(8);
    expect(SHOP.filter((i) => i.kind === 'needs').length).toBeGreaterThan(0);
    expect(SHOP.filter((i) => i.kind === 'wants').length).toBeGreaterThan(0);
  });

  it('не менее 3 целей накопления', () => {
    expect(GOALS.length).toBeGreaterThanOrEqual(3);
  });
});

describe('целостность контента', () => {
  it('все коды компетенций в заданиях существуют', () => {
    for (const quest of QUESTS) {
      for (const id of quest.competencies) expect(() => competency(id)).not.toThrow();
    }
  });

  it('все коды компетенций в товарах, терминах и событиях существуют', () => {
    for (const item of SHOP) for (const id of item.competencies) expect(() => competency(id)).not.toThrow();
    for (const t of GLOSSARY) for (const id of t.competencies) expect(() => competency(id)).not.toThrow();
    for (const e of PERIOD_EVENTS) for (const id of e.competencies) expect(() => competency(id)).not.toThrow();
  });

  it('коды компетенций уникальны', () => {
    const ids = COMPETENCIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('идентификаторы заданий, товаров и целей уникальны', () => {
    for (const list of [QUESTS.map((x) => x.id), SHOP.map((x) => x.id), GOALS.map((x) => x.id)]) {
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it('в текстах сумма не отрывается от знака Φ', () => {
    // Между числом и Φ стоит неразрывный пробел – иначе знак валюты
    // может уехать на следующую строку и остаться там один.
    for (const text of contentStrings()) expect(text).not.toMatch(/\d Φ/);
  });

  it('в текстах нет служебных символов', () => {
    // Страховка от неаккуратной пакетной правки текстов: управляющий символ
    // не виден в редакторе, но на экране получается пустой квадратик.
    // eslint-disable-next-line no-control-regex
    for (const text of contentStrings()) expect(text).not.toMatch(/[ --]/);
  });

  it('в текстах нет слова «период»', () => {
    // Дети на тестировании не понимали «период», поэтому в игре везде «неделя».
    // Слово легко вернуть новой фразой, а звучит оно по-взрослому и сбивает.
    for (const text of contentStrings()) expect(text).not.toMatch(/период/i);
  });

  it('в заданиях на распределение все нужные числа есть в условии', () => {
    // Ребёнок должен выводить ответ из условия, а не угадывать заложенную
    // нами цифру: если ждём 90 на обязательное, в условии должно быть сказано,
    // что еда и уход стоят 90.
    for (const q of QUESTS) {
      if (q.kind !== 'allocate') continue;
      const text = `${q.situation} ${q.task}`;
      for (const [bucket, value] of Object.entries(q.expect)) {
        expect(text, `${q.id} / ${bucket}`).toContain(String(value));
      }
    }
  });

  it('в списках покупок всё обязательное помещается в лимит', () => {
    for (const q of QUESTS) {
      if (q.kind !== 'cart') continue;
      const need = q.options.filter((o) => o.essential).reduce((s, o) => s + o.price, 0);
      expect(need, q.id).toBeLessThanOrEqual(q.limit);
    }
  });

  it('числа в репликах питомцев совпадают с условием задания', () => {
    // Когда в задании меняются суммы, реплики и подсказки легко забыть:
    // так в «Сдаче и чеке» питомец ещё долго вычитал 64 из 100, хотя
    // в условии уже было 50 и 35.
    const steps: Record<string, string[]> = {
      // Промежуточные числа устного счёта: 35 – это 30 и ещё 5.
      'pay-change': ['30'],
    };

    for (const quest of QUESTS) {
      const remarks = QUEST_REMARKS[quest.id];
      if (!remarks) continue;
      const inQuest = new Set(JSON.stringify(quest).match(/\d+/g) ?? []);

      for (const remark of Object.values(remarks)) {
        for (const text of [remark.says, remark.note]) {
          for (const number of text.match(/\d+/g) ?? []) {
            if (number.length < 2) continue;
            if (steps[quest.id]?.includes(number)) continue;
            expect(inQuest, `${quest.id}: «${text}»`).toContain(number);
          }
        }
      }
    }
  });

  it('недели словами в репликах совпадают с условием задания', () => {
    // «Пять недель ждать?!» – а в задании их шесть. Цифр в такой фразе нет,
    // поэтому числительные разбираем отдельно.
    const words: Record<string, number> = {
      одну: 1, две: 2, три: 3, четыре: 4, пять: 5,
      шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10,
    };

    const weeksIn = (text: string) => {
      const found = new Set<number>();
      for (const m of text.matchAll(/(\d+|[а-я]+)\s+недел/gi)) {
        const token = m[1].toLowerCase();
        const value = /^\d+$/.test(token) ? Number(token) : words[token];
        if (value) found.add(value);
      }
      return found;
    };

    for (const quest of QUESTS) {
      const remarks = QUEST_REMARKS[quest.id];
      if (!remarks) continue;
      const inQuest = weeksIn(JSON.stringify(quest));
      if (inQuest.size === 0) continue;

      for (const remark of Object.values(remarks)) {
        for (const text of [remark.says, remark.note]) {
          for (const weeks of weeksIn(text)) {
            expect([...inQuest], `${quest.id}: «${text}»`).toContain(weeks);
          }
        }
      }
    }
  });

  it('каждое задание связано хотя бы с одной компетенцией', () => {
    for (const quest of QUESTS) expect(quest.competencies.length).toBeGreaterThan(0);
  });

  it('у каждого питомца есть реплика на каждое игровое событие', () => {
    for (const s of SPECIES) {
      for (const [event, lines] of Object.entries(s.phrases)) {
        expect(lines.length, `${s.name} / ${event}`).toBeGreaterThan(0);
      }
    }
  });

  it('у каждого питомца не меньше трёх окрасов', () => {
    for (const s of SPECIES) expect(s.colors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('задание дня', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('в течение суток задание одно и то же', () => {
    const day = dayNumber('2026-09-25');
    expect(questOfDay(list, [], day)).toBe(questOfDay(list, [], day));
  });

  it('следующий день – другое задание', () => {
    const a = questOfDay(list, [], dayNumber('2026-09-25'));
    const b = questOfDay(list, [], dayNumber('2026-09-26'));
    expect(a).not.toBe(b);
  });

  it('пройденные задания не предлагаются, пока есть непройденные', () => {
    for (let day = 0; day < 12; day++) {
      expect(questOfDay(list, ['a', 'b'], day)!.id).toBe('c');
    }
  });

  it('когда пройдено всё – задание дня всё равно есть', () => {
    const daily = questOfDay(list, ['a', 'b', 'c'], dayNumber('2026-09-25'));
    expect(daily).not.toBeNull();
    expect(list).toContain(daily);
  });

  it('пустой список заданий не ломает выбор', () => {
    expect(questOfDay([], [], 5)).toBeNull();
  });

  it('номер дня растёт на единицу в сутки', () => {
    expect(dayNumber('2026-09-26') - dayNumber('2026-09-25')).toBe(1);
  });

  it('задание дня выбирается из настоящего списка заданий', () => {
    const daily = questOfDay(QUESTS, [], dayNumber('2026-09-25'));
    expect(QUESTS).toContain(daily);
  });
});
