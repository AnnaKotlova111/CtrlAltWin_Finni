/**
 * Тесты закрытия периода и развития питомца.
 */

import { describe, expect, it } from 'vitest';

import { GROWTH_POINTS, STAGE_THRESHOLDS } from './constants';
import { closePeriod, evaluatePeriod, newPeriod, withinPlan } from './period';
import { growthToNextStage, stageForGrowth, stageProgress } from './pet';
import type { PeriodState, PetStats } from './types';

function periodWith(patch: Partial<PeriodState>): PeriodState {
  return {
    ...newPeriod(1, 300, null),
    plan: { needs: 150, wants: 100, savings: 50 },
    planConfirmed: true,
    ...patch,
  };
}

const FED: PetStats = { mood: 70, fullness: 80, comfort: 70 };
const HUNGRY: PetStats = { mood: 40, fullness: 10, comfort: 40 };

describe('соответствие факта плану', () => {
  it('допускает отклонение в пределах 25 %', () => {
    expect(withinPlan(100, 100)).toBe(true);
    expect(withinPlan(100, 125)).toBe(true);
    expect(withinPlan(100, 126)).toBe(false);
  });

  it('потратить меньше плана – это не нарушение', () => {
    expect(withinPlan(100, 0)).toBe(true);
  });

  it('если по направлению ничего не планировали, трата – отклонение', () => {
    expect(withinPlan(0, 0)).toBe(true);
    expect(withinPlan(0, 10)).toBe(false);
  });
});

describe('очки развития за период', () => {
  const buy = (kind: 'needs' | 'wants', price: number) => ({
    id: 'x', itemId: 'i', title: 't', price, kind, period: 1, at: 0,
  });

  it('идеальный период даёт максимум очков', () => {
    const p = periodWith({
      fact: { needs: 150, wants: 100, savings: 50 },
      purchases: [buy('needs', 150), buy('wants', 100)],
      questsDone: ['a', 'b'],
    });
    const { points } = evaluatePeriod(p, FED);
    const max =
      GROWTH_POINTS.needsCovered + GROWTH_POINTS.planFollowed + GROWTH_POINTS.savedAsPlanned + GROWTH_POINTS.questsDone;
    expect(points).toBe(max);
  });

  it('голодный питомец не даёт очков за обязательное', () => {
    const p = periodWith({
      fact: { needs: 20, wants: 100, savings: 50 },
      purchases: [buy('needs', 20)],
      questsDone: [],
    });
    const { reasons } = evaluatePeriod(p, HUNGRY);
    expect(reasons[0].ok).toBe(false);
    expect(reasons[0].points).toBe(0);
  });

  it('перерасход по желаемому снимает очки за план, но не всё остальное', () => {
    const p = periodWith({
      fact: { needs: 150, wants: 200, savings: 50 },
      purchases: [buy('needs', 150), buy('wants', 200)],
      questsDone: ['a', 'b'],
    });
    const { reasons, points } = evaluatePeriod(p, FED);
    expect(reasons[1].ok).toBe(false);
    expect(points).toBe(
      GROWTH_POINTS.needsCovered + GROWTH_POINTS.savedAsPlanned + GROWTH_POINTS.questsDone
    );
  });

  it('без подтверждённого плана сравнивать нечего', () => {
    const p = periodWith({ plan: null, planConfirmed: false, fact: { needs: 0, wants: 0, savings: 0 } });
    const { reasons } = evaluatePeriod(p, FED);
    expect(reasons[1].ok).toBe(false);
    expect(reasons[1].text).toContain('не составлялся');
  });
});

describe('закрытие периода', () => {
  it('очки только накапливаются, стадия не понижается', () => {
    const p = periodWith({ fact: { needs: 0, wants: 0, savings: 0 } });
    const r = closePeriod(p, HUNGRY, 12, 2);
    expect(r.growthAfter).toBeGreaterThanOrEqual(12);
    expect(r.stageAfter).toBe(2);
  });

  it('показатели снижаются один раз за период и не уходят ниже нуля', () => {
    const p = periodWith({});
    const r = closePeriod(p, { mood: 5, fullness: 5, comfort: 5 }, 0, 1);
    expect(r.statsAfter.mood).toBe(0);
    expect(r.statsAfter.fullness).toBe(0);
    expect(r.statsAfter.comfort).toBe(0);
  });

  it('итог содержит и вердикт, и следующий шаг', () => {
    const r = closePeriod(periodWith({}), FED, 0, 1);
    expect(r.summary.verdict.length).toBeGreaterThan(0);
    expect(r.summary.nextStep.length).toBeGreaterThan(0);
  });
});

describe('стадии развития', () => {
  it('порог стадии определяется очками', () => {
    expect(stageForGrowth(0)).toBe(1);
    expect(stageForGrowth(STAGE_THRESHOLDS[2] - 1)).toBe(1);
    expect(stageForGrowth(STAGE_THRESHOLDS[2])).toBe(2);
    expect(stageForGrowth(STAGE_THRESHOLDS[3])).toBe(3);
    expect(stageForGrowth(999)).toBe(3);
  });

  it('до следующей стадии считается остаток', () => {
    expect(growthToNextStage(0)?.need).toBe(STAGE_THRESHOLDS[2]);
    expect(growthToNextStage(STAGE_THRESHOLDS[3])).toBeNull();
  });

  it('прогресс стадии в пределах 0…1', () => {
    expect(stageProgress(0)).toBe(0);
    expect(stageProgress(STAGE_THRESHOLDS[3])).toBe(1);
    expect(stageProgress(STAGE_THRESHOLDS[2])).toBe(0);
  });

  it('трёх стадий можно достичь за пять периодов идеальной игры', () => {
    const perPeriod =
      GROWTH_POINTS.needsCovered + GROWTH_POINTS.planFollowed + GROWTH_POINTS.savedAsPlanned + GROWTH_POINTS.questsDone;
    expect(perPeriod * 5).toBeGreaterThanOrEqual(STAGE_THRESHOLDS[3]);
  });
});
