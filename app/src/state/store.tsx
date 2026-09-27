/**
 * Состояние приложения и все игровые действия.
 *
 * Правило: ни одно изменение баланса, копилки или состояния питомца
 * не происходит молча. Каждое действие возвращает «обратную связь» –
 * что изменилось, почему и что можно сделать дальше.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';

import { GOALS } from '../content/goals';
import { periodEvent, eventForPeriod } from '../content/events';
import { petSays, species } from '../content/pets';
import { QUESTS, quest as questById, type Quest } from '../content/quests';
import { shopItem } from '../content/shop';
import {
  CUSTOM_GOAL_MAX_PRICE,
  CUSTOM_GOAL_MIN_PRICE,
  CUSTOM_GOAL_TITLE_MAX,
  DAILY_BONUS,
  INCOME_FIRST,
  INCOME_REGULAR,
  MAX_ACTIVE_GOALS,
  PARENT_BONUS_MAX,
  PROFILE_VERSION,
  STAGE_THRESHOLDS,
} from '../engine/constants';
import {
  applyStats,
  canAfford,
  money,
  periodsToGoal,
  periodsWord,
  statsDiff,
} from '../engine/economy';
import { closePeriod, newPeriod } from '../engine/period';
import {
  achieve,
  activate,
  contributionsTo,
  deposit,
  goalById,
  remove,
  savedOn,
  spendFromSavings,
  totalSaved,
  withdraw,
} from '../engine/savings';
import { moodReason } from '../engine/pet';
import { dayNumber, questOfDay, type QuestOutcome } from '../engine/quests';
import type {
  Allocation,
  ColorId,
  Goal,
  PetStats,
  Profile,
  SpeciesId,
  Stage,
} from '../engine/types';
import {
  clearDailyBonus,
  clearDailyQuest,
  clearProfile,
  dailyQuestPin,
  lastDailyBonus,
  loadProfile,
  markDailyBonus,
  pinDailyQuest,
  saveProfile,
  today,
} from './storage';

/** Что показать ребёнку после действия. */
export interface Feedback {
  id: string;
  title: string;
  tone: 'good' | 'info' | 'warn';
  /** «Что изменилось и почему» – по строке на изменение. */
  lines: string[];
  /** Реплика питомца в его характере. */
  petLine: string | null;
  /** Пояснение, которое даёт сам питомец (в заданиях). */
  petExplain?: string;
  nextStep: string | null;
  statsDelta?: Partial<PetStats>;
}

export interface AppState {
  profile: Profile | null;
  feedback: Feedback | null;
  ready: boolean;
}

export type Action =
  | { type: 'ready'; profile: Profile | null }
  | { type: 'create'; payload: { playerName: string; species: SpeciesId; color: ColorId; petName: string; isTest: boolean } }
  | { type: 'plan/draft'; allocation: Allocation }
  | { type: 'plan/confirm' }
  | { type: 'buy'; itemId: string }
  /** Сколько положить на каждую цель: { id цели: сумма }. */
  | { type: 'savings/deposit'; amounts: Record<string, number> }
  | { type: 'savings/withdraw'; goalId: string; amount: number }
  /** Начать копить на цель. replaceId – какую цель она заменяет (накопленное переносится). */
  | { type: 'goal/add'; goalId: string; replaceId?: string }
  | { type: 'goal/create'; title: string; price: number; icon: string; replaceId?: string }
  /** Убрать цель. moveToId – куда перенести накопленное; без него – на баланс. */
  | { type: 'goal/remove'; goalId: string; moveToId?: string }
  /** Цель накоплена – исполнить мечту. */
  | { type: 'goal/achieve'; goalId: string }
  | { type: 'quest/done'; questId: string; outcome: QuestOutcome; isReplay: boolean }
  | { type: 'event/resolve'; optionId: string }
  | { type: 'daily/claim' }
  | { type: 'demo/nextDay' }
  | { type: 'demo/nextStage' }
  | { type: 'period/close' }
  | { type: 'parent/bonus'; amount: number; reason: string }
  | { type: 'settings'; patch: Partial<Profile['settings']> }
  | { type: 'glossary/seen'; id: string }
  | { type: 'profile/reset' }
  | { type: 'profile/delete' }
  | { type: 'feedback/clear' };

const uid = () => Math.random().toString(36).slice(2, 10);

function blankProfile(
  playerName: string,
  species: SpeciesId,
  color: ColorId,
  petName: string,
  isTest: boolean
): Profile {
  const income = INCOME_FIRST;
  return {
    version: PROFILE_VERSION,
    playerName,
    pet: { species, color, name: petName, stage: 1, growth: 0 },
    stats: { mood: 70, fullness: 60, comfort: 60 },
    balance: income,
    goals: [...GOALS],
    activeGoalIds: [],
    savedByGoal: {},
    achievedGoals: [],
    ownedItems: {},
    period: {
      ...newPeriod(1, income, eventForPeriod(1)?.id ?? null),
      incomes: [
        { id: uid(), source: 'Стартовый бюджет', amount: income, period: 1, at: Date.now() },
      ],
    },
    history: [],
    questResults: [],
    incomeLog: [
      { id: uid(), source: 'Стартовый бюджет', amount: income, period: 1, at: Date.now() },
    ],
    purchaseLog: [],
    savingsLog: [],
    glossarySeen: [],
    settings: { animations: true, demoMode: isTest, largeText: false },
    parentBonuses: [],
    createdAt: Date.now(),
    isTestProfile: isTest,
  };
}

/** Профиль для демонстрационного режима: цель уже выбрана, чтобы сценарий шёл подряд. */
function demoProfile(): Profile {
  const p = blankProfile('Эксперт', 'finni', 'base', 'Финни', true);
  p.activeGoalIds = ['scooter'];
  p.savedByGoal = { scooter: 0 };
  return p;
}

/**
 * Делает цель активной – новой или заменой одной из текущих – и объясняет,
 * что произошло с накоплениями.
 */
function activateGoal(state: AppState, p: Profile, goal: Goal, replaceId: string | undefined): AppState {
  if (p.activeGoalIds.includes(goal.id)) return state;
  if (replaceId && !p.activeGoalIds.includes(replaceId)) return state;
  if (!replaceId && p.activeGoalIds.length >= MAX_ACTIVE_GOALS) {
    return {
      ...state,
      feedback: {
        id: uid(),
        title: 'Целей уже много',
        tone: 'warn',
        lines: [
          `Одновременно можно копить не больше чем на ${MAX_ACTIVE_GOALS} цели`,
          'Замени одну из них новой или исполни ту, что уже накоплена',
        ],
        petLine: null,
        nextStep: null,
      },
    };
  }

  const replaced = replaceId ? goalById(p, replaceId) : undefined;
  const res = activate(p, goal.id, replaceId, { uid, now: Date.now() });
  const count = res.profile.activeGoalIds.length;

  const lines = [`Стоимость – ${money(goal.price)}`];
  if (replaced) {
    lines.push(
      res.moved > 0
        ? `Накопленные на «${replaced.title}» ${money(res.moved)} перенесены на новую цель`
        : `Цель «${replaced.title}» убрана из списка`
    );
    if (res.returned > 0) {
      lines.push(`Новая цель стоит меньше, поэтому ${money(res.returned)} вернулись на баланс`);
    }
  } else if (count > 1) {
    lines.push(
      `Теперь ты копишь сразу на ${count} цели, у каждой свой прогресс. При пополнении копилки решай, сколько положить на каждую`
    );
  }
  lines.push(
    goal.custom
      ? 'Своя цель – копить на неё ещё интереснее'
      : 'Пополняй копилку каждый период – так цель становится ближе'
  );

  return {
    ...state,
    profile: res.profile,
    feedback: {
      id: uid(),
      title: `Новая цель: ${goal.title}`,
      tone: 'good',
      lines,
      petLine: petSays(p.pet.species, 'greet', goal.price),
      nextStep: 'Заложи сумму «В копилку» в план бюджета',
    },
  };
}

export function reducer(state: AppState, action: Action): AppState {
  const p = state.profile;

  switch (action.type) {
    case 'ready':
      return { profile: action.profile, feedback: null, ready: true };

    case 'create': {
      const { playerName, species, color, petName, isTest } = action.payload;
      const profile = isTest ? demoProfile() : blankProfile(playerName, species, color, petName, false);
      return {
        ...state,
        profile,
        /*
         * В демонстрационном режиме первым делом объясняем сам режим:
         * эксперт должен сразу понимать, чем «Следующий день» отличается
         * от «Подвести итоги периода» и почему события ждать не нужно.
         */
        feedback: isTest
          ? {
              id: uid(),
              title: 'Демонстрационный режим',
              tone: 'info',
              lines: [
                `Профиль готов заранее: имя, питомец и цель уже выбраны, на балансе ${money(profile.balance)}`,
                '«Подвести итоги периода» внизу главного экрана закрывает период: сравнивает план с фактом, начисляет очки развития и выдаёт финкоины следующего периода',
                '«Следующий день» рядом возвращает бонус за вход. В обычной игре он появляется раз в календарный день, здесь ждать не нужно',
                'Начиная со второго периода в каждом есть событие – подарок или непредвиденный расход. Пока событие не решено, период не закрывается',
                'Все задания открыты сразу, по времени ничего не блокируется',
              ],
              petLine: petSays(profile.pet.species, 'greet'),
              nextStep: 'Начни с вкладки «Бюджет»: распределить сумму нужно до трат – это первый шаг обязательного сценария',
            }
          : {
              id: uid(),
              title: 'Стартовый бюджет получен',
              tone: 'good',
              lines: [
                `Начислено ${money(profile.balance)} – это твои финкоины на первый период`,
                'Баланс никогда не меняется просто так: у каждого начисления есть источник',
              ],
              petLine: petSays(profile.pet.species, 'greet'),
              nextStep: 'Составь план бюджета – реши, сколько уйдёт на обязательное, желаемое и в копилку',
            },
      };
    }

    case 'plan/draft': {
      if (!p) return state;
      return { ...state, profile: { ...p, period: { ...p.period, plan: action.allocation } } };
    }

    case 'plan/confirm': {
      if (!p || !p.period.plan) return state;
      const plan = p.period.plan;
      return {
        ...state,
        profile: { ...p, period: { ...p.period, planConfirmed: true } },
        feedback: {
          id: uid(),
          title: 'План подтверждён',
          tone: 'good',
          lines: [
            `Обязательное – ${money(plan.needs)}, желаемое – ${money(plan.wants)}, в копилку – ${money(plan.savings)}`,
            'Теперь трать по плану. В конце периода сравним план с фактом',
          ],
          petLine: petSays(p.pet.species, 'greet', plan.savings),
          nextStep: 'Начни с обязательных покупок – от них зависит сытость питомца',
        },
      };
    }

    case 'buy': {
      if (!p) return state;
      const item = shopItem(action.itemId);
      const check = canAfford(p.balance, item.price, totalSaved(p));
      if (!check.ok) {
        return {
          ...state,
          feedback: {
            id: uid(),
            title: 'Пока не хватает финкоинов',
            tone: 'warn',
            lines: [`${item.title} стоит ${money(item.price)}. ${check.reason}`, ...check.options.map((o) => `• ${o}`)],
            petLine: petSays(p.pet.species, 'noMoney', item.price),
            nextStep: 'Выполни задание – за него начисляют финкоины',
          },
        };
      }

      const statsBefore = p.stats;
      const stats = applyStats(statsBefore, item.effects);
      const record = {
        id: uid(),
        itemId: item.id,
        title: item.title,
        price: item.price,
        kind: item.kind,
        period: p.period.index,
        at: Date.now(),
      };
      const fact = { ...p.period.fact, [item.kind]: p.period.fact[item.kind] + item.price };

      const profile: Profile = {
        ...p,
        balance: p.balance - item.price,
        stats,
        ownedItems: { ...p.ownedItems, [item.id]: (p.ownedItems[item.id] ?? 0) + 1 },
        period: { ...p.period, fact, purchases: [...p.period.purchases, record] },
        purchaseLog: [...p.purchaseLog, record],
      };

      const plannedLeft = p.period.planConfirmed && p.period.plan
        ? p.period.plan[item.kind] - fact[item.kind]
        : null;

      const gained = statsDiff(statsBefore, stats);
      const lines = [
        `Баланс: ${money(p.balance)} → ${money(profile.balance)}`,
        `${item.impact}. ${moodReason(stats)}`,
      ];
      // Показатель не растёт выше 100. Если прибавка оказалась меньше
      // обещанной, честно об этом говорим – иначе цифры не сходятся.
      const capped = Object.entries(item.effects).some(
        ([key, value]) => (gained[key as keyof PetStats] ?? 0) < (value ?? 0)
      );
      if (capped) {
        lines.push('Показатель уже почти на максимуме, поэтому прибавка получилась меньше');
      }
      if (plannedLeft !== null) {
        lines.push(
          plannedLeft >= 0
            ? `По направлению «${item.kind === 'needs' ? 'Обязательное' : 'Желаемое'}» в плане осталось ${money(plannedLeft)}`
            : `Это направление превысило план на ${money(-plannedLeft)}`
        );
      }

      return {
        ...state,
        profile,
        feedback: {
          id: uid(),
          title: `Куплено: ${item.title}`,
          tone: plannedLeft !== null && plannedLeft < 0 ? 'warn' : 'good',
          lines,
          petLine: petSays(p.pet.species, item.kind === 'needs' ? 'buyNeed' : 'buyWant', item.price),
          nextStep:
            plannedLeft !== null && plannedLeft < 0
              ? 'Перенеси следующую необязательную покупку на новый период – план ещё можно выровнять'
              : null,
          statsDelta: gained,
        },
      };
    }

    case 'savings/deposit': {
      if (!p) return state;
      const res = deposit(p, action.amounts, { uid, now: Date.now() });
      if (!res) return state;
      const profile = res.profile;

      const lines = [`Баланс: ${money(p.balance)} → ${money(profile.balance)}`];
      let reachedAny = false;
      for (const d of res.deposited) {
        const goal = goalById(profile, d.goalId)!;
        const saved = savedOn(profile, d.goalId);
        const remaining = Math.max(0, goal.price - saved);
        let line = `«${goal.title}»: +${money(d.amount)}, накоплено ${money(saved)} из ${money(goal.price)}`;
        if (remaining === 0) {
          reachedAny = true;
          line += ' Цель накоплена!';
        } else {
          const eta = periodsToGoal(remaining, contributionsTo(profile.savingsLog, d.goalId));
          if (eta && eta.periods > 0) {
            line += ` Если откладывать в среднем по ${money(eta.average)}, осталось примерно ${eta.periods} ${periodsWord(eta.periods)}`;
          }
        }
        lines.push(line);
      }

      return {
        ...state,
        profile,
        feedback: {
          id: uid(),
          title: reachedAny ? 'Цель накоплена!' : 'Копилка пополнена',
          tone: 'good',
          lines,
          petLine: petSays(p.pet.species, reachedAny ? 'goalReached' : 'save', res.total),
          nextStep: reachedAny
            ? 'Нажми «Исполнить мечту» на карточке цели – и в копилке освободится место для новой'
            : null,
        },
      };
    }

    case 'savings/withdraw': {
      if (!p) return state;
      const goal = goalById(p, action.goalId);
      if (!goal) return state;
      const before = savedOn(p, action.goalId);
      const res = withdraw(p, action.goalId, action.amount, { uid, now: Date.now() });
      if (!res) return state;
      return {
        ...state,
        profile: res.profile,
        feedback: {
          id: uid(),
          title: 'Снято из копилки',
          tone: 'warn',
          lines: [
            `«${goal.title}»: ${money(before)} → ${money(before - res.amount)}.`,
            `Баланс: ${money(p.balance)} → ${money(res.profile.balance)}`,
            'Прогресс по этой цели уменьшился – но его можно вернуть следующим пополнением',
          ],
          petLine: petSays(p.pet.species, 'planOff', res.amount),
          nextStep: 'Отложи эту сумму обратно в следующем периоде – цель снова приблизится',
        },
      };
    }

    case 'goal/add': {
      if (!p) return state;
      const goal = goalById(p, action.goalId);
      if (!goal) return state;
      return activateGoal(state, p, goal, action.replaceId);
    }

    case 'goal/create': {
      if (!p) return state;
      const title = action.title.trim().slice(0, CUSTOM_GOAL_TITLE_MAX);
      const price = Math.round(action.price);
      if (!title || !(price >= CUSTOM_GOAL_MIN_PRICE && price <= CUSTOM_GOAL_MAX_PRICE)) return state;
      const goal: Goal = {
        id: `custom-${uid()}`,
        title,
        price,
        hint: 'Твоя собственная цель',
        icon: action.icon,
        custom: true,
        createdPeriod: p.period.index,
      };
      const next = activateGoal(state, { ...p, goals: [...p.goals, goal] }, goal, action.replaceId);
      // Если цель не добавилась (например, их уже слишком много), не сохраняем её и в каталоге.
      return next.profile && next.profile.activeGoalIds.includes(goal.id) ? next : { ...next, profile: p };
    }

    case 'goal/remove': {
      if (!p) return state;
      const goal = goalById(p, action.goalId);
      if (!goal || !p.activeGoalIds.includes(goal.id)) return state;
      const target = action.moveToId ? goalById(p, action.moveToId) : undefined;
      if (action.moveToId && (!target || action.moveToId === goal.id || !p.activeGoalIds.includes(action.moveToId))) {
        return state;
      }
      const res = remove(p, goal.id, action.moveToId, { uid, now: Date.now() });

      const lines = [`Цель «${goal.title}» убрана из списка`];
      if (target && res.moved > 0) lines.push(`${money(res.moved)} перенесены на «${target.title}»`);
      if (res.returned > 0) {
        lines.push(
          target
            ? `В цену «${target.title}» поместилось не всё – ${money(res.returned)} вернулись на баланс`
            : `${money(res.returned)} вернулись на баланс`
        );
      }
      return {
        ...state,
        profile: res.profile,
        feedback: {
          id: uid(),
          title: 'Цель убрана',
          tone: 'info',
          lines,
          petLine: null,
          nextStep: res.profile.activeGoalIds.length === 0 ? 'Выбери новую цель – копить интереснее, когда понятно ради чего' : null,
        },
      };
    }

    case 'goal/achieve': {
      if (!p) return state;
      const goal = goalById(p, action.goalId);
      const profile = goal ? achieve(p, goal.id, { uid, now: Date.now() }) : null;
      if (!goal || !profile) return state;
      return {
        ...state,
        profile,
        feedback: {
          id: uid(),
          title: `Мечта исполнена: ${goal.title}!`,
          tone: 'good',
          lines: [
            `${money(goal.price)} из копилки ушли на эту мечту`,
            'Мечта теперь в списке «Исполненные мечты», а в копилке освободилось место для новой цели',
          ],
          petLine: petSays(p.pet.species, 'goalReached', goal.price),
          nextStep: 'Придумай новую цель – копить интереснее, когда есть к чему стремиться',
        },
      };
    }

    case 'quest/done': {
      if (!p) return state;
      const q = questById(action.questId);
      const { outcome } = action;
      const statsBefore = p.stats;
      const stats = applyStats(statsBefore, { mood: outcome.moodDelta });
      const income = outcome.reward > 0
        ? { id: uid(), source: `Задание «${q.title}»`, amount: outcome.reward, period: p.period.index, at: Date.now() }
        : null;

      const alreadyDone = p.period.questsDone.includes(q.id);

      const profile: Profile = {
        ...p,
        balance: p.balance + outcome.reward,
        stats,
        period: {
          ...p.period,
          questsDone: alreadyDone ? p.period.questsDone : [...p.period.questsDone, q.id],
          incomes: income ? [...p.period.incomes, income] : p.period.incomes,
        },
        questResults: [
          ...p.questResults,
          { questId: q.id, period: p.period.index, grade: outcome.grade, reward: outcome.reward, at: Date.now() },
        ],
        incomeLog: income ? [...p.incomeLog, income] : p.incomeLog,
      };

      // Что произошло и сколько начислено – фактами; почему так – объясняет питомец.
      const lines: string[] = [];
      if (outcome.outcome) lines.push(outcome.outcome);
      if (outcome.reward > 0) {
        lines.push(`Начислено ${money(outcome.reward)} за задание «${q.title}». Баланс: ${money(p.balance)} → ${money(profile.balance)}`);
      } else if (action.isReplay) {
        lines.push('Это повтор задания – финкоины за него уже начислялись');
      }

      return {
        ...state,
        profile,
        feedback: {
          id: uid(),
          title: outcome.grade === 'good' ? 'Отличное решение' : outcome.grade === 'partial' ? 'Почти получилось' : 'Есть что обсудить',
          tone: outcome.grade === 'good' ? 'good' : outcome.grade === 'partial' ? 'info' : 'warn',
          lines,
          petLine: petSays(p.pet.species, outcome.grade === 'weak' ? 'questWeak' : 'questGood', outcome.reward),
          petExplain: outcome.explain,
          nextStep: outcome.nextStep,
          statsDelta: statsDiff(statsBefore, stats),
        },
      };
    }

    case 'event/resolve': {
      if (!p || !p.period.eventId) return state;
      const ev = periodEvent(p.period.eventId);

      if (ev.kind === 'income') {
        const income = { id: uid(), source: ev.title, amount: ev.amount, period: p.period.index, at: Date.now() };
        return {
          ...state,
          profile: {
            ...p,
            balance: p.balance + ev.amount,
            period: { ...p.period, eventResolved: true, incomes: [...p.period.incomes, income] },
            incomeLog: [...p.incomeLog, income],
          },
          feedback: {
            id: uid(),
            title: ev.title,
            tone: 'good',
            lines: [ev.text, `Баланс: ${money(p.balance)} → ${money(p.balance + ev.amount)}`],
            petLine: petSays(p.pet.species, 'greet', ev.amount),
            nextStep: 'Такой доход можно сразу отправить в копилку – он не был в плане',
          },
        };
      }

      const option = ev.options!.find((o) => o.id === action.optionId)!;
      let profile: Profile = { ...p, period: { ...p.period, eventResolved: true } };
      const lines = [option.outcome];

      if (option.from === 'balance') {
        if (p.balance < ev.amount) {
          return {
            ...state,
            feedback: {
              id: uid(),
              title: 'На балансе не хватает',
              tone: 'warn',
              lines: [`Нужно ${money(ev.amount)}, на балансе ${money(p.balance)}`, '• Можно взять из копилки', '• Можно перенести на следующий период'],
              petLine: petSays(p.pet.species, 'noMoney', ev.amount),
              nextStep: 'Выбери другой вариант – отрицательный баланс в игре невозможен',
            },
          };
        }
        const record = { id: uid(), itemId: ev.id, title: ev.title, price: ev.amount, kind: 'needs' as const, period: p.period.index, at: Date.now() };
        profile = {
          ...profile,
          balance: p.balance - ev.amount,
          period: {
            ...profile.period,
            fact: { ...p.period.fact, needs: p.period.fact.needs + ev.amount },
            purchases: [...p.period.purchases, record],
          },
          purchaseLog: [...p.purchaseLog, record],
        };
        lines.push(`Баланс: ${money(p.balance)} → ${money(profile.balance)}`);
      } else if (option.from === 'savings') {
        const paid = spendFromSavings(profile, ev.amount, ev.title, { uid, now: Date.now() });
        if (!paid) {
          return {
            ...state,
            feedback: {
              id: uid(),
              title: 'В копилке недостаточно',
              tone: 'warn',
              lines: [`Нужно ${money(ev.amount)}, в копилке ${money(totalSaved(p))}`],
              petLine: petSays(p.pet.species, 'noMoney', ev.amount),
              nextStep: 'Выбери оплату с баланса или перенос на следующий период',
            },
          };
        }
        profile = paid.profile;
        for (const t of paid.taken) {
          lines.push(`Копилка «${goalById(p, t.goalId)?.title ?? 'цель'}»: −${money(t.amount)}`);
        }
      } else {
        const statsBefore = p.stats;
        const stats = applyStats(statsBefore, { comfort: -10 });
        profile = {
          ...profile,
          stats,
          period: { ...profile.period, carriedEvent: { eventId: ev.id, amount: ev.amount } },
        };
        lines.push('Трата перенесена: она появится в начале следующего периода');
      }

      return {
        ...state,
        profile,
        feedback: {
          id: uid(),
          title: ev.title,
          tone: option.from === 'balance' ? 'good' : 'warn',
          lines,
          petLine: petSays(p.pet.species, option.from === 'balance' ? 'buyNeed' : 'planOff', ev.amount),
          nextStep:
            option.from === 'balance'
              ? null
              : 'Попробуй в следующем плане оставить небольшой запас «на всякий случай»',
          statsDelta: option.from === 'postpone' ? { comfort: -10 } : undefined,
        },
      };
    }

    case 'daily/claim': {
      if (!p) return state;
      const income = { id: uid(), source: 'Ежедневный вход', amount: DAILY_BONUS, period: p.period.index, at: Date.now() };
      markDailyBonus(today());
      return {
        ...state,
        profile: {
          ...p,
          balance: p.balance + DAILY_BONUS,
          period: { ...p.period, incomes: [...p.period.incomes, income] },
          incomeLog: [...p.incomeLog, income],
        },
        feedback: {
          id: uid(),
          title: 'Бонус за вход',
          tone: 'good',
          lines: [
            `Начислено ${money(DAILY_BONUS)}. Источник – ежедневный вход в приложение`,
            `Баланс: ${money(p.balance)} → ${money(p.balance + DAILY_BONUS)}`,
          ],
          petLine: petSays(p.pet.species, 'greet', DAILY_BONUS),
          nextStep: null,
        },
      };
    }

    case 'demo/nextDay': {
      if (!p) return state;
      clearDailyBonus();
      clearDailyQuest();
      return {
        ...state,
        profile: { ...p },
        feedback: {
          id: uid(),
          title: 'Наступил следующий день',
          tone: 'info',
          lines: [
            'Бонус за вход снова доступен – в обычной игре он появляется раз в календарный день',
            'Задание дня обновилось',
            'Период не изменился: чтобы закрыть его, нужно подвести итоги',
          ],
          petLine: null,
          nextStep: 'Забери бонус наверху, рядом с балансом',
        },
      };
    }

    /* Демонстрационный режим: показать все три стадии питомца, не набирая
       очки развития. Стадии идут по кругу: 1 → 2 → 3 → 1. */
    case 'demo/nextStage': {
      if (!p) return state;
      const next = (p.pet.stage === 3 ? 1 : p.pet.stage + 1) as Stage;
      const s = species(p.pet.species);
      return {
        ...state,
        profile: {
          ...p,
          pet: { ...p.pet, stage: next, growth: STAGE_THRESHOLDS[next] },
        },
        feedback: {
          id: uid(),
          title: `Стадия ${next} · ${s.stageNames[next - 1]}`,
          tone: 'good',
          lines: [
            'Это демо-режим: стадия переключена вручную',
            'В обычной игре питомец растёт от очков развития за период',
          ],
          petLine: null,
          nextStep: null,
        },
      };
    }

    case 'period/close': {
      if (!p) return state;
      const { summary, statsAfter, growthAfter, stageAfter } = closePeriod(
        p.period,
        p.stats,
        p.pet.growth,
        p.pet.stage
      );

      const nextIndex = p.period.index + 1;
      const carried = p.period.carriedEvent;
      const regular = { id: uid(), source: 'Карманные финкоины', amount: INCOME_REGULAR, period: nextIndex, at: Date.now() };
      const balanceAfter = p.balance + INCOME_REGULAR - (carried?.amount ?? 0);

      const period = newPeriod(nextIndex, Math.max(0, balanceAfter), eventForPeriod(nextIndex)?.id ?? null);
      period.incomes = [regular];

      const carryLines: string[] = [];
      let fact = period.fact;
      let purchases = period.purchases;
      let purchaseLog = p.purchaseLog;
      if (carried) {
        const ev = periodEvent(carried.eventId);
        const record = { id: uid(), itemId: ev.id, title: `${ev.title} (перенос)`, price: carried.amount, kind: 'needs' as const, period: nextIndex, at: Date.now() };
        fact = { ...fact, needs: carried.amount };
        purchases = [record];
        purchaseLog = [...purchaseLog, record];
        carryLines.push(`Перенесённая трата «${ev.title}» списана: ${money(carried.amount)}`);
      }

      const profile: Profile = {
        ...p,
        balance: Math.max(0, balanceAfter),
        stats: statsAfter,
        pet: { ...p.pet, growth: growthAfter, stage: stageAfter },
        history: [...p.history, summary],
        incomeLog: [...p.incomeLog, regular],
        purchaseLog,
        period: { ...period, fact, purchases },
      };

      const grew = stageAfter > summary.stageBefore;

      return {
        ...state,
        profile,
        feedback: {
          id: uid(),
          title: grew ? 'Новая стадия развития!' : `Период ${summary.period} завершён`,
          tone: grew ? 'good' : summary.growthGained >= 4 ? 'good' : 'info',
          lines: [
            summary.verdict,
            `Очков развития за период: +${summary.growthGained}`,
            `Начислено ${money(INCOME_REGULAR)} – карманные финкоины нового периода`,
            ...carryLines,
          ],
          petLine: petSays(p.pet.species, grew ? 'stageUp' : summary.growthGained >= 4 ? 'planOk' : 'planOff', summary.period),
          nextStep: summary.nextStep,
        },
      };
    }

    case 'parent/bonus': {
      if (!p) return state;
      // Сумма – целое число от 1 до PARENT_BONUS_MAX, причина – непустая строка.
      const amount = Math.min(PARENT_BONUS_MAX, Math.max(0, Math.round(action.amount)));
      const reason = action.reason.trim().slice(0, 40);
      if (amount <= 0 || !reason) return state;
      const income = { id: uid(), source: `От взрослого: ${reason}`, amount, period: p.period.index, at: Date.now() };
      return {
        ...state,
        profile: {
          ...p,
          balance: p.balance + amount,
          parentBonuses: [...p.parentBonuses, income],
          period: { ...p.period, incomes: [...p.period.incomes, income] },
          incomeLog: [...p.incomeLog, income],
        },
        feedback: {
          id: uid(),
          title: 'Начисление от взрослого',
          tone: 'good',
          lines: [`${reason}: ${money(amount)}.`, `Баланс: ${money(p.balance)} → ${money(p.balance + amount)}`],
          petLine: petSays(p.pet.species, 'greet', amount),
          nextStep: null,
        },
      };
    }

    case 'settings':
      if (!p) return state;
      return { ...state, profile: { ...p, settings: { ...p.settings, ...action.patch } } };

    case 'glossary/seen':
      if (!p || p.glossarySeen.includes(action.id)) return state;
      return { ...state, profile: { ...p, glossarySeen: [...p.glossarySeen, action.id] } };

    case 'profile/reset': {
      if (!p) return state;
      const fresh = p.isTestProfile
        ? demoProfile()
        : blankProfile(p.playerName, p.pet.species, p.pet.color, p.pet.name, false);
      return {
        ...state,
        profile: fresh,
        feedback: {
          id: uid(),
          title: 'Профиль сброшен',
          tone: 'info',
          lines: ['Прогресс возвращён к исходному состоянию. Питомец и имя сохранены'],
          petLine: null,
          nextStep: 'Можно пройти сценарий заново',
        },
      };
    }

    case 'profile/delete':
      clearProfile();
      return { profile: null, feedback: null, ready: true };

    case 'feedback/clear':
      return { ...state, feedback: null };

    default:
      return state;
  }
}

interface Store extends AppState {
  dispatch: React.Dispatch<Action>;
  /** Цели, на которые ребёнок копит сейчас, с накопленным. */
  activeGoals: { goal: Goal; saved: number }[];
  totalSavings: number;
  /** Доступен ли сегодня бонус за вход. */
  dailyAvailable: boolean;
  /** Задание дня – одно и то же до конца суток. */
  dailyQuest: Quest | null;
  /** Задание дня уже решено. */
  dailyQuestDone: boolean;
}

/** Выбирает задание дня и запоминает выбор до конца суток. */
function pickDailyQuest(p: Profile | null): Quest | null {
  if (!p) return null;
  const day = today();
  const pin = dailyQuestPin();
  if (pin && pin.date === day) {
    const kept = QUESTS.find((q) => q.id === pin.id);
    if (kept) return kept;
  }
  const picked = questOfDay(
    QUESTS,
    p.questResults.map((r) => r.questId),
    dayNumber(day)
  );
  if (picked) pinDailyQuest(day, picked.id);
  return picked;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { profile: null, feedback: null, ready: false });

  useEffect(() => {
    dispatch({ type: 'ready', profile: loadProfile() });
  }, []);

  useEffect(() => {
    if (state.ready && state.profile) saveProfile(state.profile);
  }, [state.profile, state.ready]);

  const value = useMemo<Store>(() => {
    const p = state.profile;
    const dailyQuest = pickDailyQuest(p);
    const activeGoals = p
      ? p.activeGoalIds
          .map((id) => goalById(p, id))
          .filter((g): g is Goal => !!g)
          .map((goal) => ({ goal, saved: savedOn(p, goal.id) }))
      : [];
    return {
      ...state,
      dispatch,
      activeGoals,
      totalSavings: p ? totalSaved(p) : 0,
      // В демонстрационном режиме бонус доступен всегда – сценарий идёт без ожидания.
      dailyAvailable: !!p && lastDailyBonus() !== today(),
      dailyQuest,
      dailyQuestDone: !!dailyQuest && !!p && p.questResults.some((r) => r.questId === dailyQuest.id),
    };
  }, [state]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * React-контекст переживает горячую замену модуля плохо: после подмены
 * store.tsx компоненты продолжают читать старый контекст и падают
 * с «useStore вызван вне StoreProvider». Просим Vite перезагрузить
 * страницу целиком. На production-сборку это не влияет.
 */
if (import.meta.hot) {
  import.meta.hot.invalidate();
}

export function useStore(): Store {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore вызван вне StoreProvider');
  return ctx;
}

/** Профиль без проверки на null – для экранов, которые рисуются только с профилем. */
export function useProfile(): Profile {
  const { profile } = useStore();
  if (!profile) throw new Error('Профиль ещё не создан');
  return profile;
}
