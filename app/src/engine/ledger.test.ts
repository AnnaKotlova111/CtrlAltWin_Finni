/**
 * Тесты истории финкоинов и своих целей.
 *
 * Главное свойство: после любой последовательности действий сумма изменений
 * баланса по истории равна текущему балансу. То есть баланс никогда
 * не меняется без записи, которую ребёнок видит на экране «Мои финкоины».
 */

import { describe, expect, it } from 'vitest';

import { quest } from '../content/quests';
import { reducer, type Action, type AppState } from '../state/store';
import { CUSTOM_GOAL_MAX_PRICE, PARENT_BONUS_MAX } from './constants';
import { buildLedger, ledgerTotals } from './ledger';
import { gradeQuest } from './quests';

function run(actions: Action[]): AppState {
  let state: AppState = { profile: null, feedback: null, ready: true };
  for (const a of actions) state = reducer(state, a);
  return state;
}

function ledgerBalance(state: AppState): number {
  return buildLedger(state.profile!).reduce((s, e) => s + e.balanceDelta, 0);
}

const create: Action = {
  type: 'create',
  payload: { playerName: 'Тест', species: 'lucky', color: 'base', petName: 'Лиса', isTest: false },
};

const questDone = (id: string, optionId: string): Action => ({
  type: 'quest/done',
  questId: id,
  outcome: gradeQuest(quest(id), { kind: 'choice', optionId }, false),
  isReplay: false,
});

describe('история финкоинов сходится с балансом', () => {
  it('после всех видов операций за три периода', () => {
    const state = run([
      create,
      { type: 'goal/add', goalId: 'scooter' },
      { type: 'goal/add', goalId: 'tent' },
      { type: 'plan/draft', allocation: { needs: 150, wants: 80, savings: 70 } },
      { type: 'plan/confirm' },
      { type: 'buy', itemId: 'bowl' },
      { type: 'buy', itemId: 'ball' },
      { type: 'buy', itemId: 'cake' },
      { type: 'buy', itemId: 'cake' }, // не хватит – баланс не должен измениться
      { type: 'savings/deposit', amounts: { scooter: 40, tent: 30 } },
      { type: 'savings/withdraw', goalId: 'tent', amount: 20 },
      questDone('save-wait', 'wait'),
      { type: 'daily/claim' },
      { type: 'parent/bonus', amount: 30, reason: 'Помощь по дому' },
      { type: 'period/close' },
      // период 2: приятное событие – подарок
      { type: 'event/resolve', optionId: 'ok' },
      { type: 'savings/deposit', amounts: { scooter: 100 } },
      { type: 'period/close' },
      // период 3: осмотр оплачиваем из копилки – мимо баланса
      { type: 'event/resolve', optionId: 'savings' },
      { type: 'buy', itemId: 'water' },
      // перенос между целями и возврат на баланс
      { type: 'goal/remove', goalId: 'tent', moveToId: 'scooter' },
      { type: 'goal/add', goalId: 'aquapark' },
      { type: 'savings/deposit', amounts: { aquapark: 20 } },
      { type: 'goal/remove', goalId: 'aquapark' },
      { type: 'period/close' },
    ]);
    const p = state.profile!;
    expect(ledgerBalance(state)).toBe(p.balance);

    const kinds = new Set(buildLedger(p).map((e) => e.kind));
    for (const k of ['income', 'spend', 'toSavings', 'fromSavings', 'paidFromSavings', 'transfer']) {
      expect(kinds.has(k as never), k).toBe(true);
    }
  });

  it('когда трата перенесена на следующий период', () => {
    const state = run([
      create,
      { type: 'period/close' },
      { type: 'period/close' },
      { type: 'event/resolve', optionId: 'postpone' }, // осмотр – в период 4
      { type: 'period/close' },
    ]);
    expect(ledgerBalance(state)).toBe(state.profile!.balance);
    expect(buildLedger(state.profile!).some((e) => e.title.includes('перенос'))).toBe(true);
  });

  it('оплата из копилки видна в истории, но баланс не трогает', () => {
    const state = run([
      create,
      { type: 'goal/add', goalId: 'scooter' },
      { type: 'savings/deposit', amounts: { scooter: 100 } },
      { type: 'period/close' },
      { type: 'period/close' },
      { type: 'event/resolve', optionId: 'savings' },
    ]);
    const paid = buildLedger(state.profile!).find((e) => e.kind === 'paidFromSavings')!;
    expect(paid.balanceDelta).toBe(0);
    expect(paid.amount).toBe(60);
    expect(paid.detail).toContain('Самокат');
  });

  it('самые свежие операции – сверху', () => {
    const state = run([create, { type: 'buy', itemId: 'bowl' }, { type: 'daily/claim' }]);
    const ledger = buildLedger(state.profile!);
    for (let i = 1; i < ledger.length; i++) {
      expect(ledger[i - 1].at).toBeGreaterThanOrEqual(ledger[i].at);
    }
  });

  it('итоги считают пришедшее, потраченное и отложенное', () => {
    const state = run([
      create,
      { type: 'goal/add', goalId: 'tent' },
      { type: 'buy', itemId: 'bowl' },
      { type: 'savings/deposit', amounts: { tent: 50 } },
    ]);
    const t = ledgerTotals(buildLedger(state.profile!));
    expect(t).toEqual({ income: 300, spent: 30, saved: 50 });
  });
});

describe('своя цель', () => {
  it('создаётся с введёнными названием и стоимостью и сразу выбирается', () => {
    const state = run([create, { type: 'goal/create', title: '  Велосипед  ', price: 3200, icon: 'target' }]);
    const p = state.profile!;
    const goal = p.goals.find((g) => g.custom)!;
    expect(goal.title).toBe('Велосипед');
    expect(goal.price).toBe(3200);
    expect(goal.createdPeriod).toBe(1);
    expect(p.activeGoalIds).toEqual([goal.id]);
  });

  it('не создаётся без названия или со стоимостью вне рамок', () => {
    for (const bad of [
      { title: '   ', price: 500 },
      { title: 'Замок', price: CUSTOM_GOAL_MAX_PRICE + 1 },
      { title: 'Жвачка', price: 10 },
    ]) {
      const state = run([create, { type: 'goal/create', icon: 'target', ...bad }]);
      expect(state.profile!.goals.some((g) => g.custom), JSON.stringify(bad)).toBe(false);
    }
  });
});

describe('начисление от взрослого', () => {
  it('сумма сверх лимита урезается до лимита в логике, а не только на экране', () => {
    const state = run([create, { type: 'parent/bonus', amount: PARENT_BONUS_MAX + 1, reason: 'Много' }]);
    expect(state.profile!.balance).toBe(300 + PARENT_BONUS_MAX);
    expect(ledgerBalance(state)).toBe(state.profile!.balance);
  });

  it('пустая причина не принимается', () => {
    const state = run([create, { type: 'parent/bonus', amount: 20, reason: '   ' }]);
    expect(state.profile!.balance).toBe(300);
  });
});
