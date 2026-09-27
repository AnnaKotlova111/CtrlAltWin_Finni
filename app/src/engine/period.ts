/**
 * Закрытие игрового периода: сравнение плана с фактом, обратная связь
 * и начисление очков развития питомца.
 *
 * Принцип «безопасной ошибки»: неудачный период не обнуляет прогресс.
 * Очки развития только накапливаются, стадия никогда не понижается.
 */

import {
  FULLNESS_OK,
  GROWTH_POINTS,
  PERIOD_DECAY,
  PLAN_TOLERANCE,
  QUESTS_FOR_BONUS,
} from './constants';
import { applyStats, emptyAllocation, money } from './economy';
import { stageForGrowth } from './pet';
import type { Allocation, PeriodState, PeriodSummary, PetStats, Stage } from './types';

/** За что начислены (или не начислены) очки развития. */
export type GrowthKey = 'needs' | 'plan' | 'savings' | 'quests';

export interface GrowthReason {
  key: GrowthKey;
  text: string;
  points: number;
  ok: boolean;
}

/** Уложился ли факт в план по направлению с допуском PLAN_TOLERANCE. */
export function withinPlan(planned: number, actual: number): boolean {
  if (planned === 0) return actual === 0;
  return actual <= planned * (1 + PLAN_TOLERANCE);
}

/**
 * Считает очки развития за период и объясняет каждое начисление.
 * Объяснение потом показывается ребёнку слово в слово.
 */
export function evaluatePeriod(
  period: PeriodState,
  statsAtClose: PetStats
): { points: number; reasons: GrowthReason[] } {
  const plan = period.plan ?? emptyAllocation();
  const boughtNeeds = period.purchases.some((p) => p.kind === 'needs');
  const needsCovered = boughtNeeds && statsAtClose.fullness >= FULLNESS_OK;

  const planFollowed =
    period.planConfirmed &&
    withinPlan(plan.needs, period.fact.needs) &&
    withinPlan(plan.wants, period.fact.wants);

  const savedAsPlanned = plan.savings > 0 ? period.fact.savings >= plan.savings : period.fact.savings > 0;

  const enoughQuests = period.questsDone.length >= QUESTS_FOR_BONUS;

  const reasons: GrowthReason[] = [
    {
      key: 'needs',
      text: needsCovered
        ? 'Обязательные расходы закрыты – питомец сыт и ухожен'
        : 'Обязательные расходы закрыты не полностью',
      points: needsCovered ? GROWTH_POINTS.needsCovered : 0,
      ok: needsCovered,
    },
    {
      key: 'plan',
      text: planFollowed
        ? 'Факт совпал с планом бюджета'
        : period.planConfirmed
          ? 'Потрачено заметно больше, чем планировалось'
          : 'План бюджета в этом периоде не составлялся',
      points: planFollowed ? GROWTH_POINTS.planFollowed : 0,
      ok: planFollowed,
    },
    {
      key: 'savings',
      text: savedAsPlanned
        ? `В копилку ушло ${money(period.fact.savings)}`
        : period.fact.savings > 0
          ? `В копилку ушло ${money(period.fact.savings)} – меньше, чем планировалось (${money(plan.savings)})`
          : 'В копилку в этом периоде ничего не отложено',
      points: savedAsPlanned ? GROWTH_POINTS.savedAsPlanned : 0,
      ok: savedAsPlanned,
    },
    {
      key: 'quests',
      text: enoughQuests
        ? `Выполнено заданий: ${period.questsDone.length}`
        : `Заданий выполнено: ${period.questsDone.length} из ${QUESTS_FOR_BONUS}`,
      points: enoughQuests ? GROWTH_POINTS.questsDone : 0,
      ok: enoughQuests,
    },
  ];

  return { points: reasons.reduce((s, r) => s + r.points, 0), reasons };
}

/** Короткий вывод периода и следующий шаг. */
export function verdictFor(
  reasons: GrowthReason[],
  planned: boolean
): { verdict: string; nextStep: string } {
  const failed = reasons.filter((r) => !r.ok);
  if (failed.length === 0) {
    return {
      verdict: 'Отличный период: обязательное закрыто, план выполнен, копилка пополнилась',
      nextStep: 'Попробуй в следующем периоде отложить чуть больше – цель станет ближе',
    };
  }
  const first = failed[0];
  switch (first.key) {
    case 'needs':
      return {
        verdict: 'Питомцу не хватило обязательных покупок – от них зависит сытость и комфорт',
        nextStep: 'В новом плане поставь на «Обязательное» сумму побольше и купи еду в начале периода',
      };
    case 'plan':
      return planned
        ? {
            verdict: 'Потрачено больше, чем было в плане. Прогресс при этом сохранён',
            nextStep: 'Сократи «Желаемое» в новом плане или перенеси одну покупку на следующий период',
          }
        : {
            verdict: 'В этом периоде плана не было, поэтому сравнить с фактом нечего',
            nextStep: 'Начни новый период с плана – так видно, куда уходят финкоины',
          };
    case 'savings':
      return {
        verdict: 'Период прошёл спокойно, но до запланированной суммы в копилке не дошло',
        nextStep: 'Отложи хотя бы небольшую сумму – регулярность важнее размера',
      };
    default:
      return {
        verdict: 'Хороший период. Осталось выполнить чуть больше заданий',
        nextStep: 'Загляни в «Задания» – за каждое начисляют финкоины и объясняют результат',
      };
  }
}

/**
 * Итог периода целиком: показатели «до» и «после», очки, вердикт.
 * Показатели снижаются один раз при закрытии периода (жизнь идёт),
 * и это снижение объясняется ребёнку.
 */
export function closePeriod(
  period: PeriodState,
  stats: PetStats,
  growth: number,
  stage: Stage
): { summary: PeriodSummary; statsAfter: PetStats; growthAfter: number; stageAfter: Stage } {
  const { points, reasons } = evaluatePeriod(period, stats);

  const statsAfter = applyStats(stats, {
    fullness: -PERIOD_DECAY.fullness,
    mood: -PERIOD_DECAY.mood,
    comfort: -PERIOD_DECAY.comfort,
  });

  const growthAfter = growth + points;
  const stageAfter = stageForGrowth(growthAfter);
  const { verdict, nextStep } = verdictFor(reasons, period.planConfirmed);

  const summary: PeriodSummary = {
    period: period.index,
    income: period.income,
    plan: period.plan ?? emptyAllocation(),
    fact: { ...period.fact },
    growthGained: points,
    growthReasons: reasons,
    statsBefore: stats,
    statsAfter,
    stageBefore: stage,
    stageAfter,
    questsDone: period.questsDone.length,
    verdict,
    nextStep,
  };

  return { summary, statsAfter, growthAfter, stageAfter };
}

/** Пустой период с заданным доступным бюджетом. */
export function newPeriod(index: number, income: number, eventId: string | null): PeriodState {
  return {
    index,
    income,
    plan: null,
    planConfirmed: false,
    fact: emptyAllocation(),
    purchases: [],
    incomes: [],
    savingsOps: [],
    questsDone: [],
    eventId,
    eventResolved: false,
    carriedEvent: null,
  };
}

/** Насколько факт отличается от плана – для экрана сравнения. */
export function planVsFact(plan: Allocation, fact: Allocation) {
  return (['needs', 'wants', 'savings'] as const).map((key) => ({
    key,
    planned: plan[key],
    actual: fact[key],
    diff: fact[key] - plan[key],
  }));
}
