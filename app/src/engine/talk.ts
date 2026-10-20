/**
 * «Что обсудить дома»: короткие наблюдения для взрослого.
 *
 * Каждое наблюдение собрано из настоящих решений ребёнка и называет числа,
 * которые он видел сам, – иначе взрослому не о чем спрашивать. Общих фраз
 * вроде «поговорите о деньгах» здесь нет.
 *
 * Правила смотрят на последнюю закрытую неделю и на текущую: разговор нужен
 * про свежее. Тексты безличные – пол ребёнка игра не знает.
 */

import { FULLNESS_OK } from './constants';
import { money } from './economy';
import { goalById, savedOn } from './savings';
import type { Profile } from './types';

export interface TalkPoint {
  id: string;
  /** Что произошло – по числам игры. */
  fact: string;
  /** О чём спросить ребёнка. */
  ask: string;
}

/** Больше трёх вопросов за раз никто не задаст. */
const MAX_POINTS = 3;

/** Насколько давнее событие ещё стоит обсуждать, в неделях. */
const FRESH = 1;

/** С какого расхождения план и факт уже стоит обсудить. */
const GAP = 50;

type Rule = (p: Profile) => TalkPoint | null;

/** Последняя закрытая неделя. Пока её нет, большинству правил сказать нечего. */
const lastWeek = (p: Profile) => p.history[p.history.length - 1];

const goalReached: Rule = (p) => {
  const last = p.achievedGoals[p.achievedGoals.length - 1];
  if (!last || p.period.index - last.period > FRESH) return null;
  const goal = goalById(p, last.goalId);
  if (!goal) return null;
  return {
    id: 'goal-reached',
    fact: `Мечта «${goal.title}» исполнена на неделе ${last.period}: ${money(goal.price)} собраны понемногу`,
    ask: 'Похвалите и спросите, что было самым трудным, пока копилось',
  };
};

const newStage: Rule = (p) => {
  const week = lastWeek(p);
  if (!week || week.stageAfter <= week.stageBefore) return null;
  return {
    id: 'new-stage',
    fact: `Питомец перешёл на стадию ${week.stageAfter}: очки развития приносят недели с планом и копилкой`,
    ask: 'Спросите, что, по мнению ребёнка, помогло питомцу вырасти',
  };
};

const wantsOverNeeds: Rule = (p) => {
  const week = lastWeek(p);
  if (!week || week.fact.wants <= week.fact.needs) return null;
  if (week.statsAfter.fullness >= FULLNESS_OK) return null;
  return {
    id: 'wants-over-needs',
    fact: `На неделе ${week.period} на желаемое ушло ${money(week.fact.wants)}, на обязательное – ${money(week.fact.needs)}, и питомец остался голодным`,
    ask: 'Спросите, что тогда казалось важнее и что стоило бы купить сначала',
  };
};

const savingsSpent: Rule = (p) => {
  // Деньги из копилки на непредвиденный расход – сильный момент: цель
  // отодвинулась, зато выручила подушка безопасности.
  const taken = [...p.savingsLog]
    .reverse()
    .find((r) => r.spentOn && !r.spentOn.startsWith('Мечта исполнена'));
  if (!taken || p.period.index - taken.period > FRESH) return null;
  return {
    id: 'savings-spent',
    fact: `Непредвиденный расход «${taken.spentOn}» закрыли из копилки: ${money(-taken.amount)}`,
    ask: 'Спросите, какие были варианты и чем этот оказался лучше остальных',
  };
};

const savingsStalled: Rule = (p) => {
  const goalId = p.activeGoalIds[0];
  const goal = goalId ? goalById(p, goalId) : undefined;
  if (!goal || p.period.index < 3) return null;
  const since = p.period.index - 1;
  if (p.savingsLog.some((r) => r.amount > 0 && r.period >= since)) return null;
  const left = Math.max(0, goal.price - savedOn(p, goalId));
  return {
    id: 'savings-stalled',
    fact: `Две недели в копилку ничего не уходило, а до мечты «${goal.title}» не хватает ${money(left)}`,
    ask: 'Спросите, не поменялась ли мечта – может быть, стоит выбрать цель поближе',
  };
};

const noPlan: Rule = (p) => {
  const week = lastWeek(p);
  if (!week) return null;
  if (week.plan.needs + week.plan.wants + week.plan.savings > 0) return null;
  return {
    id: 'no-plan',
    fact: `Неделя ${week.period} прошла без плана: финкоины тратились по ходу дела`,
    ask: 'Спросите, что мешает решить заранее, и попробуйте составить план вместе',
  };
};

const planGap: Rule = (p) => {
  const week = lastWeek(p);
  if (!week || week.plan.needs + week.plan.wants + week.plan.savings === 0) return null;
  // Если про обязательное и желаемое уже сказано выше, не повторяем те же
  // числа другими словами – остаётся копилка.
  const spoken = wantsOverNeeds(p) !== null;
  const lines = [
    ...(spoken
      ? []
      : [
          { title: 'на обязательное', plan: week.plan.needs, fact: week.fact.needs },
          { title: 'на желаемое', plan: week.plan.wants, fact: week.fact.wants },
        ]),
    { title: 'в копилку', plan: week.plan.savings, fact: week.fact.savings },
  ];
  const worst = lines.reduce((a, b) =>
    Math.abs(b.fact - b.plan) > Math.abs(a.fact - a.plan) ? b : a
  );
  if (Math.abs(worst.fact - worst.plan) < GAP) return null;
  return {
    id: 'plan-gap',
    fact: `На неделе ${week.period} ${worst.title} планировалось ${money(worst.plan)}, а вышло ${money(worst.fact)}`,
    ask: 'Спросите, из-за чего план разошёлся с жизнью и каким он будет на этой неделе',
  };
};

const questsIdle: Rule = (p) => {
  const week = lastWeek(p);
  if (!week || week.questsDone > 0) return null;
  return {
    id: 'quests-idle',
    fact: `За неделю ${week.period} не пройдено ни одного задания`,
    ask: 'Предложите решить одно вместе – они короткие, на пару минут',
  };
};

const customGoal: Rule = (p) => {
  const own = p.goals.find((g) => g.custom && p.activeGoalIds.includes(g.id));
  if (!own) return null;
  return {
    id: 'custom-goal',
    fact: `Мечта придумана самостоятельно: «${own.title}» за ${money(own.price)}`,
    ask: 'Спросите, почему именно она – удобный повод поговорить о настоящих покупках',
  };
};

const calmWeek: Rule = (p) => {
  // Когда обсуждать нечего, разговор всё равно нужен: хорошее решение
  // ребёнок замечает за собой хуже, чем ошибку.
  const week = lastWeek(p);
  if (!week || week.statsAfter.fullness < FULLNESS_OK) return null;
  return {
    id: 'calm-week',
    fact: `Неделя ${week.period} прошла спокойно: питомец остался сытым`,
    ask: 'Похвалите и спросите, что получилось лучше всего – это решение, а не везение',
  };
};

const justStarted: Rule = (p) => {
  if (p.history.length > 0) return null;
  return {
    id: 'start',
    fact: `Игра только началась: идёт первая неделя, на балансе ${money(p.balance)}`,
    ask: 'Спросите, ради чего хочется копить – с мечты в игре всё и начинается',
  };
};

/** Сначала редкое и важное, потом разговор про привычки. */
const RULES: Rule[] = [
  goalReached,
  newStage,
  wantsOverNeeds,
  savingsSpent,
  savingsStalled,
  noPlan,
  planGap,
  questsIdle,
  customGoal,
  calmWeek,
  justStarted,
];

export function talkPoints(p: Profile): TalkPoint[] {
  const out: TalkPoint[] = [];
  for (const rule of RULES) {
    const point = rule(p);
    if (point) out.push(point);
    if (out.length === MAX_POINTS) break;
  }
  return out;
}
