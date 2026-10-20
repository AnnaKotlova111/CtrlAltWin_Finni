/**
 * Тесты копилки с несколькими целями: пополнение по целям, снятие
 * с конкретной цели, перенос при замене и удалении, исполнение мечты,
 * лимит целей и перевод старых сохранений.
 */

import { describe, expect, it } from 'vitest';

import { migrate } from '../state/storage';
import { reducer, type Action, type AppState } from '../state/store';
import { MAX_ACTIVE_GOALS } from './constants';
import { buildLedger } from './ledger';
import {
  contributionsByPeriod,
  contributionsTo,
  plannedSavingsLeft,
  savedOn,
  spreadDeposit,
  totalSaved,
} from './savings';

function run(actions: Action[]): AppState {
  let state: AppState = { profile: null, feedback: null, ready: true };
  for (const a of actions) state = reducer(state, a);
  return state;
}

const create: Action = {
  type: 'create',
  payload: { playerName: 'Тест', species: 'finni', color: 'base', petName: 'Финни', isTest: false },
};

/** Баланс + копилка + потраченное из копилки = всё, что пришло, минус покупки. Ничего не теряется. */
function conserved(state: AppState): boolean {
  const p = state.profile!;
  const income = p.incomeLog.reduce((s, r) => s + r.amount, 0);
  const spent = p.purchaseLog.reduce((s, r) => s + r.price, 0);
  const spentFromSavings = p.savingsLog.filter((r) => r.spentOn).reduce((s, r) => s - r.amount, 0);
  return p.balance + totalSaved(p) + spentFromSavings === income - spent;
}

describe('темп пополнений', () => {
  const rec = (period: number, amount: number, goalId = 'scooter', extra = {}) => ({
    id: `r${period}-${amount}`,
    goalId,
    amount,
    period,
    at: period * 1000,
    ...extra,
  });

  it('складывает пополнения одной недели вместе', () => {
    const log = [rec(1, 10), rec(1, 10), rec(1, 10), rec(2, 50)];
    expect(contributionsByPeriod(log, 'scooter')).toEqual([
      { period: 1, amount: 30 },
      { period: 2, amount: 50 },
    ]);
  });

  it('снятия и переносы в темп не попадают', () => {
    const log = [
      rec(1, 50),
      rec(1, -20),
      rec(2, 40, 'scooter', { movedFrom: 'tent' }),
      rec(2, 30),
    ];
    expect(contributionsByPeriod(log, 'scooter')).toEqual([
      { period: 1, amount: 50 },
      { period: 2, amount: 30 },
    ]);
  });

  it('без цели считает все цели сразу', () => {
    const log = [rec(1, 50, 'scooter'), rec(1, 30, 'tent'), rec(2, 20, 'tent')];
    expect(contributionsByPeriod(log)).toEqual([
      { period: 1, amount: 80 },
      { period: 2, amount: 20 },
    ]);
  });
});

describe('несколько целей', () => {
  it('можно копить на две цели, у каждой свой прогресс', () => {
    const s = run([
      create,
      { type: 'goal/add', goalId: 'scooter' },
      { type: 'goal/add', goalId: 'tent' },
      { type: 'savings/deposit', amounts: { scooter: 60, tent: 40 } },
    ]);
    const p = s.profile!;
    expect(p.activeGoalIds).toEqual(['scooter', 'tent']);
    expect(p.savedByGoal).toMatchObject({ scooter: 60, tent: 40 });
    expect(p.balance).toBe(200);
    expect(p.period.fact.savings).toBe(100);
    expect(conserved(s)).toBe(true);
  });

  it('больше трёх целей одновременно не добавить – только заменить', () => {
    const s = run([
      create,
      { type: 'goal/add', goalId: 'scooter' },
      { type: 'goal/add', goalId: 'tent' },
      { type: 'goal/add', goalId: 'aquapark' },
      { type: 'goal/add', goalId: 'telescope' },
    ]);
    expect(s.profile!.activeGoalIds).toHaveLength(MAX_ACTIVE_GOALS);
    expect(s.profile!.activeGoalIds).not.toContain('telescope');
    expect(s.feedback!.tone).toBe('warn');
  });

  it('на цель нельзя положить больше, чем ей не хватает, и больше баланса', () => {
    const s = run([create, { type: 'goal/create', title: 'Мелочь', price: 50, icon: 'target' }]);
    const id = s.profile!.activeGoalIds[0];
    const after = reducer(s, { type: 'savings/deposit', amounts: { [id]: 200 } });
    expect(after.profile!.savedByGoal[id]).toBe(50);
    expect(after.profile!.balance).toBe(250);

    const tooMuch = run([create, { type: 'goal/add', goalId: 'telescope' }, { type: 'savings/deposit', amounts: { telescope: 400 } }]);
    expect(tooMuch.profile!.balance).toBe(300);
    expect(tooMuch.profile!.savedByGoal.telescope).toBe(0);
  });

  it('снимать можно только с указанной цели', () => {
    const s = run([
      create,
      { type: 'goal/add', goalId: 'scooter' },
      { type: 'goal/add', goalId: 'tent' },
      { type: 'savings/deposit', amounts: { scooter: 60, tent: 40 } },
      { type: 'savings/withdraw', goalId: 'tent', amount: 30 },
    ]);
    expect(s.profile!.savedByGoal).toMatchObject({ scooter: 60, tent: 10 });
    expect(s.profile!.balance).toBe(230);
  });
});

describe('замена цели', () => {
  it('накопленное переходит на новую цель, старая уходит из списка', () => {
    const s = run([
      create,
      { type: 'goal/add', goalId: 'scooter' },
      { type: 'savings/deposit', amounts: { scooter: 120 } },
      { type: 'goal/add', goalId: 'telescope', replaceId: 'scooter' },
    ]);
    const p = s.profile!;
    expect(p.activeGoalIds).toEqual(['telescope']);
    expect(p.savedByGoal).toMatchObject({ scooter: 0, telescope: 120 });
    expect(p.balance).toBe(180);
    expect(conserved(s)).toBe(true);
  });

  it('если новая цель дешевле накопленного, лишнее возвращается на баланс', () => {
    const s = run([
      create,
      { type: 'goal/add', goalId: 'scooter' },
      { type: 'savings/deposit', amounts: { scooter: 250 } },
      { type: 'goal/create', title: 'Мяч', price: 100, icon: 'ball', replaceId: 'scooter' },
    ]);
    const p = s.profile!;
    const ball = p.goals.find((g) => g.title === 'Мяч')!;
    expect(p.savedByGoal[ball.id]).toBe(100);
    expect(p.balance).toBe(50 + 150);
    expect(conserved(s)).toBe(true);
  });

  it('перенос не считается новым пополнением – срок цели не искажается', () => {
    const s = run([
      create,
      { type: 'goal/add', goalId: 'scooter' },
      { type: 'savings/deposit', amounts: { scooter: 120 } },
      { type: 'goal/add', goalId: 'telescope', replaceId: 'scooter' },
    ]);
    expect(contributionsTo(s.profile!.savingsLog, 'telescope')).toEqual([]);
    expect(buildLedger(s.profile!).filter((e) => e.kind === 'transfer')).toHaveLength(1);
  });
});

describe('удаление цели', () => {
  const base: Action[] = [
    create,
    { type: 'goal/add', goalId: 'scooter' },
    { type: 'goal/add', goalId: 'tent' },
    { type: 'savings/deposit', amounts: { scooter: 80, tent: 40 } },
  ];

  it('накопленное можно перенести на другую цель', () => {
    const s = run([...base, { type: 'goal/remove', goalId: 'tent', moveToId: 'scooter' }]);
    expect(s.profile!.activeGoalIds).toEqual(['scooter']);
    expect(s.profile!.savedByGoal.scooter).toBe(120);
    expect(conserved(s)).toBe(true);
  });

  it('или вернуть на баланс', () => {
    const s = run([...base, { type: 'goal/remove', goalId: 'tent' }]);
    expect(s.profile!.activeGoalIds).toEqual(['scooter']);
    expect(s.profile!.balance).toBe(180 + 40);
    expect(conserved(s)).toBe(true);
  });
});

describe('исполнение мечты', () => {
  it('накопленная цель исполняется и уходит в «Исполненные мечты»', () => {
    const s = run([create, { type: 'goal/create', title: 'Книга', price: 200, icon: 'book' }]);
    const id = s.profile!.activeGoalIds[0];
    const final = [
      { type: 'savings/deposit', amounts: { [id]: 200 } },
      { type: 'goal/achieve', goalId: id },
    ].reduce((st, a) => reducer(st, a as Action), s);
    const p = final.profile!;
    expect(p.activeGoalIds).toEqual([]);
    expect(p.achievedGoals.map((a) => a.goalId)).toEqual([id]);
    expect(p.savedByGoal[id]).toBe(0);
    expect(buildLedger(p).some((e) => e.kind === 'paidFromSavings' && e.title.includes('Книга'))).toBe(true);
    expect(conserved(final)).toBe(true);
  });

  it('недокопленную цель исполнить нельзя', () => {
    const s = run([
      create,
      { type: 'goal/add', goalId: 'tent' },
      { type: 'savings/deposit', amounts: { tent: 100 } },
      { type: 'goal/achieve', goalId: 'tent' },
    ]);
    expect(s.profile!.activeGoalIds).toEqual(['tent']);
    expect(s.profile!.achievedGoals).toEqual([]);
  });
});

describe('внезапная трата из копилки', () => {
  it('берётся с цели, где накоплено больше всего', () => {
    const s = run([
      create,
      { type: 'goal/add', goalId: 'scooter' },
      { type: 'goal/add', goalId: 'tent' },
      { type: 'savings/deposit', amounts: { scooter: 40, tent: 90 } },
      { type: 'period/close' },
      { type: 'period/close' },
      { type: 'event/resolve', optionId: 'savings' }, // осмотр, 60 Φ
    ]);
    expect(s.profile!.savedByGoal).toMatchObject({ scooter: 40, tent: 30 });
    expect(conserved(s)).toBe(true);
  });

  it('если на одной цели не хватает – добирает с другой', () => {
    const s = run([
      create,
      { type: 'goal/add', goalId: 'scooter' },
      { type: 'goal/add', goalId: 'tent' },
      { type: 'savings/deposit', amounts: { scooter: 40, tent: 30 } },
      { type: 'period/close' },
      { type: 'period/close' },
      { type: 'event/resolve', optionId: 'savings' },
    ]);
    expect(totalSaved(s.profile!)).toBe(10);
    expect(conserved(s)).toBe(true);
  });
});

describe('перевод старых сохранений', () => {
  it('финкоины на прежней цели становятся видны: такая цель снова в списке', () => {
    const fresh = run([create]).profile!;
    // Так выглядело сохранение версии 1: одна активная цель, но деньги лежат и на прежней.
    const { activeGoalIds: _a, achievedGoals: _b, ...rest } = fresh;
    const v1 = { ...rest, version: 1, activeGoalId: 'tent', savedByGoal: { scooter: 120, tent: 30 } };

    const p = migrate(v1 as unknown as Record<string, unknown>)!;
    expect(p.version).toBe(2);
    expect(p.activeGoalIds).toEqual(['tent', 'scooter']);
    expect(p.achievedGoals).toEqual([]);
    expect('activeGoalId' in p).toBe(false);
  });

  it('неизвестная версия не загружается', () => {
    expect(migrate({ version: 99 })).toBeNull();
  });
});

describe('«сначала отложи»', () => {
  const plan = (savings: number): Action[] => [
    { type: 'plan/draft', allocation: { needs: 150, wants: 100, savings } },
    { type: 'plan/confirm' },
  ];

  it('пока план не подтверждён, откладывать нечего', () => {
    const s = run([create, { type: 'goal/add', goalId: 'scooter' }, { type: 'plan/draft', allocation: { needs: 150, wants: 100, savings: 50 } }]);
    expect(plannedSavingsLeft(s.profile!.period)).toBe(0);
  });

  it('после подтверждения плана остаётся отложить запланированное', () => {
    const s = run([create, { type: 'goal/add', goalId: 'scooter' }, ...plan(50)]);
    expect(plannedSavingsLeft(s.profile!.period)).toBe(50);
  });

  it('кнопка в окне откладывает всё за один шаг, и напоминание гаснет', () => {
    const s = run([create, { type: 'goal/add', goalId: 'scooter' }, ...plan(50)]);
    const act = s.feedback!.act;
    expect(act).toBeDefined();
    // Деньги не уходят от одного нажатия: у действия есть вопрос.
    expect(act!.confirm?.title).toContain('50');

    const after = reducer(s, act!.action);
    expect(plannedSavingsLeft(after.profile!.period)).toBe(0);
    expect(totalSaved(after.profile!)).toBe(50);
    expect(conserved(after)).toBe(true);
  });

  it('если отложено больше плана, напоминание не возвращается', () => {
    const s = run([
      create,
      { type: 'goal/add', goalId: 'scooter' },
      ...plan(50),
      { type: 'savings/deposit', amounts: { scooter: 80 } },
    ]);
    expect(plannedSavingsLeft(s.profile!.period)).toBe(0);
  });

  it('без цели кнопки нет: выбрать мечту за ребёнка игра не может', () => {
    const s = run([create, ...plan(50)]);
    expect(s.feedback!.act).toBeUndefined();
    // Сам остаток при этом виден – на главном экране он позовёт в копилку.
    expect(plannedSavingsLeft(s.profile!.period)).toBe(50);
  });

  it('при двух целях сумма делится между ними, и об этом сказано', () => {
    const s = run([
      create,
      { type: 'goal/add', goalId: 'scooter' },
      { type: 'goal/add', goalId: 'tent' },
      ...plan(50),
    ]);
    const act = s.feedback!.act;
    expect(act!.label).toContain('50');
    // В вопросе названы обе мечты – ребёнок видит, кому сколько достанется.
    expect(act!.confirm!.body).toContain('Самокат');
    expect(act!.confirm!.body).toContain('Домик-палатка');

    const after = reducer(s, act!.action);
    expect(savedOn(after.profile!, 'scooter')).toBe(25);
    expect(savedOn(after.profile!, 'tent')).toBe(25);
    expect(plannedSavingsLeft(after.profile!.period)).toBe(0);
  });

  it('почти накопленной мечте достаётся только остаток, лишнее – другой', () => {
    const s = run([
      create,
      { type: 'goal/create', title: 'Мячик', price: 60, icon: 'ball' },
      { type: 'goal/add', goalId: 'scooter' },
    ]);
    const ball = s.profile!.goals.find((g) => g.title === 'Мячик')!;
    const filled = reducer(s, { type: 'savings/deposit', amounts: { [ball.id]: 50 } });

    // Мячику осталось 10 Φ: поровну вышло бы по 50, но больше в него не влезет.
    const split = spreadDeposit(filled.profile!, 100);
    expect(split[ball.id]).toBe(10);
    expect(split.scooter).toBe(90);
  });

  it('без целей раскладывать некуда', () => {
    const s = run([create]);
    expect(spreadDeposit(s.profile!, 100)).toEqual({});
  });
});
