/**
 * Тесты наблюдений для взрослого: каждое правило срабатывает только по делу
 * и называет настоящие числа из профиля.
 */

import { describe, expect, it } from 'vitest';

import { reducer, type Action, type AppState } from '../state/store';
import { talkPoints } from './talk';
import type { PeriodSummary, Profile } from './types';

const create: Action = {
  type: 'create',
  payload: { playerName: 'Тест', species: 'finni', color: 'base', petName: 'Финни', isTest: false },
};

/** Профиль после знакомства – дальше правим поля под нужную ситуацию. */
function fresh(): Profile {
  let state: AppState = { profile: null, feedback: null, ready: true };
  state = reducer(state, create);
  return state.profile!;
}

/** Закрытая неделя с нужными числами. Остальное берём нейтральным. */
function week(patch: Partial<PeriodSummary> = {}): PeriodSummary {
  return {
    period: 1,
    income: 300,
    plan: { needs: 150, wants: 100, savings: 50 },
    fact: { needs: 150, wants: 100, savings: 50 },
    growthGained: 4,
    growthReasons: [],
    statsBefore: { mood: 70, fullness: 70, comfort: 70 },
    statsAfter: { mood: 70, fullness: 70, comfort: 70 },
    stageBefore: 1,
    stageAfter: 1,
    questsDone: 2,
    verdict: '',
    nextStep: '',
    ...patch,
  };
}

const ids = (p: Profile) => talkPoints(p).map((point) => point.id);

describe('что обсудить дома', () => {
  it('в самом начале зовёт поговорить о мечте', () => {
    const p = fresh();
    const points = talkPoints(p);
    expect(points).toHaveLength(1);
    expect(points[0].id).toBe('start');
    expect(points[0].fact).toContain('300');
  });

  it('желаемое вместо обязательного – с числами той недели', () => {
    const p: Profile = {
      ...fresh(),
      history: [
        week({
          period: 2,
          fact: { needs: 40, wants: 120, savings: 0 },
          statsAfter: { mood: 60, fullness: 20, comfort: 60 },
        }),
      ],
      period: { ...fresh().period, index: 3 },
    };
    const point = talkPoints(p).find((x) => x.id === 'wants-over-needs')!;
    expect(point.fact).toContain('120');
    expect(point.fact).toContain('40');
  });

  it('сытый питомец – про желаемое не напоминаем', () => {
    const p: Profile = {
      ...fresh(),
      history: [
        week({
          fact: { needs: 40, wants: 120, savings: 0 },
          statsAfter: { mood: 70, fullness: 80, comfort: 70 },
        }),
      ],
    };
    expect(ids(p)).not.toContain('wants-over-needs');
  });

  it('копилка стоит две недели – называем, сколько не хватает', () => {
    const base = fresh();
    const p: Profile = {
      ...base,
      activeGoalIds: ['scooter'],
      savedByGoal: { scooter: 100 },
      savingsLog: [{ id: 's1', goalId: 'scooter', amount: 100, period: 1, at: 0 }],
      history: [week({ period: 3 })],
      period: { ...base.period, index: 4 },
    };
    const point = talkPoints(p).find((x) => x.id === 'savings-stalled')!;
    expect(point.fact).toContain('500');
  });

  it('если на этой неделе откладывали – копилку не поминаем', () => {
    const base = fresh();
    const p: Profile = {
      ...base,
      activeGoalIds: ['scooter'],
      savedByGoal: { scooter: 100 },
      savingsLog: [{ id: 's1', goalId: 'scooter', amount: 50, period: 4, at: 0 }],
      history: [week({ period: 3 })],
      period: { ...base.period, index: 4 },
    };
    expect(ids(p)).not.toContain('savings-stalled');
  });

  it('неделя без плана заметна, а с планом – нет', () => {
    const base = fresh();
    const without: Profile = {
      ...base,
      history: [week({ plan: { needs: 0, wants: 0, savings: 0 } })],
    };
    expect(ids(without)).toContain('no-plan');

    const withPlan: Profile = { ...base, history: [week()] };
    expect(ids(withPlan)).not.toContain('no-plan');
  });

  it('заметное расхождение плана и факта, мелкое – пропускаем', () => {
    const base = fresh();
    const big: Profile = {
      ...base,
      history: [week({ fact: { needs: 150, wants: 100, savings: 0 } })],
    };
    const point = talkPoints(big).find((x) => x.id === 'plan-gap')!;
    expect(point.fact).toContain('в копилку');

    const small: Profile = {
      ...base,
      history: [week({ fact: { needs: 160, wants: 110, savings: 30 } })],
    };
    expect(ids(small)).not.toContain('plan-gap');
  });

  it('не повторяем те же числа: про обязательное сказано один раз', () => {
    const base = fresh();
    const p: Profile = {
      ...base,
      history: [
        week({
          plan: { needs: 150, wants: 40, savings: 30 },
          fact: { needs: 40, wants: 120, savings: 30 },
          statsAfter: { mood: 45, fullness: 20, comfort: 48 },
        }),
      ],
    };
    const points = talkPoints(p);
    expect(points.map((x) => x.id)).toContain('wants-over-needs');
    // Про обязательное уже сказано, а копилка в плане сошлась – второго
    // наблюдения с теми же числами быть не должно.
    expect(points.map((x) => x.id)).not.toContain('plan-gap');
  });

  it('деньги из копилки на непредвиденный расход – повод для разговора', () => {
    const base = fresh();
    const p: Profile = {
      ...base,
      savingsLog: [
        { id: 'a', goalId: 'scooter', amount: 100, period: 1, at: 0 },
        { id: 'b', goalId: 'scooter', amount: -60, period: 1, at: 0, spentOn: 'Поход к доктору' },
      ],
      history: [week()],
    };
    const point = talkPoints(p).find((x) => x.id === 'savings-spent')!;
    expect(point.fact).toContain('Поход к доктору');
    expect(point.fact).toContain('60');
  });

  it('исполненная мечта не путается с тратой из копилки', () => {
    const base = fresh();
    const p: Profile = {
      ...base,
      savingsLog: [
        { id: 'a', goalId: 'scooter', amount: -600, period: 1, at: 0, spentOn: 'Мечта исполнена: Самокат' },
      ],
      history: [week()],
    };
    expect(ids(p)).not.toContain('savings-spent');
  });

  it('старое не обсуждаем: мечта исполнена давно', () => {
    const base = fresh();
    const p: Profile = {
      ...base,
      achievedGoals: [{ goalId: 'scooter', period: 2, at: 0 }],
      history: [week({ period: 5 })],
      period: { ...base.period, index: 6 },
    };
    expect(ids(p)).not.toContain('goal-reached');
  });

  it('больше трёх вопросов за раз не даём', () => {
    const base = fresh();
    const p: Profile = {
      ...base,
      achievedGoals: [{ goalId: 'scooter', period: 1, at: 0 }],
      activeGoalIds: ['tent'],
      savedByGoal: { tent: 0 },
      history: [
        week({
          period: 1,
          plan: { needs: 0, wants: 0, savings: 0 },
          fact: { needs: 40, wants: 120, savings: 0 },
          statsAfter: { mood: 30, fullness: 10, comfort: 30 },
          stageBefore: 1,
          stageAfter: 2,
          questsDone: 0,
        }),
      ],
      period: { ...base.period, index: 2 },
    };
    expect(talkPoints(p)).toHaveLength(3);
  });

  it('после ровной недели раздел не пустует', () => {
    const p: Profile = { ...fresh(), history: [week()] };
    const points = talkPoints(p);
    expect(points.length).toBeGreaterThan(0);
    expect(points.map((x) => x.id)).toContain('calm-week');
  });

  it('в каждом наблюдении есть и факт, и вопрос', () => {
    const base = fresh();
    const p: Profile = {
      ...base,
      history: [week({ plan: { needs: 0, wants: 0, savings: 0 }, questsDone: 0 })],
    };
    for (const point of talkPoints(p)) {
      expect(point.fact.length).toBeGreaterThan(20);
      expect(point.ask).toMatch(/[Сс]просите|[Пп]редложите|[Пп]охвалите/);
    }
  });
});
