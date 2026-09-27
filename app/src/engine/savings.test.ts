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
import { contributionsTo, totalSaved } from './savings';

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
