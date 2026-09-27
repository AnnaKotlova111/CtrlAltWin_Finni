/**
 * Копилка с несколькими целями.
 *
 * Ребёнок может копить на несколько целей сразу (до MAX_ACTIVE_GOALS).
 * У каждой цели своя сумма и свой прогресс. Правила:
 *
 *  • Пополнение – ребёнок сам решает, сколько положить на каждую цель.
 *    На цель нельзя положить больше, чем ей не хватает.
 *  • Снятие – всегда с конкретной цели. Так видно, какая мечта отодвинется.
 *  • Перенос – при замене или удалении цели накопленное можно перенести
 *    на другую цель. Что не помещается в её цену, возвращается на баланс.
 *  • Исполнение мечты – накопленная цель «покупается»: финкоины уходят
 *    из копилки, цель переходит в «Исполненные мечты».
 *  • Внезапная трата из копилки – берётся с цели, где накоплено больше всего.
 *
 * Все функции чистые: принимают профиль и возвращают новый.
 */

import type { Goal, Profile, SavingRecord } from './types';

export interface Ctx {
  uid: () => string;
  now: number;
}

/** Цель по id. */
export function goalById(p: Pick<Profile, 'goals'>, id: string): Goal | undefined {
  return p.goals.find((g) => g.id === id);
}

export function savedOn(p: Pick<Profile, 'savedByGoal'>, id: string): number {
  return p.savedByGoal[id] ?? 0;
}

/** Сколько ещё не хватает до цены цели. */
export function roomOn(p: Pick<Profile, 'goals' | 'savedByGoal'>, id: string): number {
  const g = goalById(p, id);
  return g ? Math.max(0, g.price - savedOn(p, id)) : 0;
}

export function totalSaved(p: Pick<Profile, 'savedByGoal'>): number {
  return Object.values(p.savedByGoal).reduce((s, v) => s + v, 0);
}

/**
 * Настоящие пополнения цели – для расчёта среднего и срока.
 * Перенос с другой цели пополнением не считается.
 */
export function contributionsTo(log: SavingRecord[], goalId: string): number[] {
  return log.filter((r) => r.goalId === goalId && r.amount > 0 && !r.movedFrom).map((r) => r.amount);
}

function withRecords(p: Profile, records: SavingRecord[]): Profile {
  return {
    ...p,
    savingsLog: [...p.savingsLog, ...records],
    period: { ...p.period, savingsOps: [...p.period.savingsOps, ...records] },
  };
}

/* ─────────────────────────── Пополнение ─────────────────────────── */

export interface DepositResult {
  profile: Profile;
  /** Сколько реально легло на каждую цель. */
  deposited: { goalId: string; amount: number }[];
  total: number;
}

/**
 * Раскладывает финкоины с баланса по целям. Каждая сумма ограничена тем,
 * сколько цели не хватает; общая сумма – балансом. Возвращает null,
 * если класть нечего или не хватает баланса.
 */
export function deposit(p: Profile, amounts: Record<string, number>, ctx: Ctx): DepositResult | null {
  const deposited = p.activeGoalIds
    .map((goalId) => ({ goalId, amount: Math.min(Math.max(0, Math.round(amounts[goalId] ?? 0)), roomOn(p, goalId)) }))
    .filter((d) => d.amount > 0);
  const total = deposited.reduce((s, d) => s + d.amount, 0);
  if (total <= 0 || total > p.balance) return null;

  const savedByGoal = { ...p.savedByGoal };
  for (const d of deposited) savedByGoal[d.goalId] = savedOn(p, d.goalId) + d.amount;

  const records: SavingRecord[] = deposited.map((d) => ({
    id: ctx.uid(),
    goalId: d.goalId,
    amount: d.amount,
    period: p.period.index,
    at: ctx.now,
  }));

  const profile = withRecords(
    {
      ...p,
      balance: p.balance - total,
      savedByGoal,
      period: { ...p.period, fact: { ...p.period.fact, savings: p.period.fact.savings + total } },
    },
    records
  );
  return { profile, deposited, total };
}

/* ─────────────────────────── Снятие ─────────────────────────── */

/** Снимает финкоины с конкретной цели на баланс. */
export function withdraw(p: Profile, goalId: string, amount: number, ctx: Ctx): { profile: Profile; amount: number } | null {
  const take = Math.min(Math.round(amount), savedOn(p, goalId));
  if (take <= 0) return null;
  const record: SavingRecord = { id: ctx.uid(), goalId, amount: -take, period: p.period.index, at: ctx.now };
  const profile = withRecords(
    {
      ...p,
      balance: p.balance + take,
      savedByGoal: { ...p.savedByGoal, [goalId]: savedOn(p, goalId) - take },
      period: { ...p.period, fact: { ...p.period.fact, savings: Math.max(0, p.period.fact.savings - take) } },
    },
    [record]
  );
  return { profile, amount: take };
}

/* ─────────────────────────── Перенос ─────────────────────────── */

export interface TransferResult {
  profile: Profile;
  /** Сколько перешло на другую цель. */
  moved: number;
  /** Сколько не поместилось в цену цели и вернулось на баланс. */
  returned: number;
}

/** Переносит всё накопленное с одной цели на другую; лишнее – на баланс. */
export function transfer(p: Profile, fromId: string, toId: string, ctx: Ctx): TransferResult {
  const amount = savedOn(p, fromId);
  const moved = Math.min(amount, roomOn(p, toId));
  const returned = amount - moved;
  if (amount <= 0) return { profile: p, moved: 0, returned: 0 };

  const records: SavingRecord[] = [];
  if (moved > 0) {
    records.push(
      { id: ctx.uid(), goalId: fromId, amount: -moved, period: p.period.index, at: ctx.now, movedTo: toId },
      { id: ctx.uid(), goalId: toId, amount: moved, period: p.period.index, at: ctx.now, movedFrom: fromId }
    );
  }
  let profile: Profile = {
    ...p,
    savedByGoal: { ...p.savedByGoal, [fromId]: amount - moved, [toId]: savedOn(p, toId) + moved },
  };
  profile = withRecords(profile, records);

  if (returned > 0) {
    const back = withdraw(profile, fromId, returned, ctx);
    if (back) profile = back.profile;
  }
  return { profile, moved, returned };
}

/* ─────────────────────── Добавление и удаление целей ─────────────────────── */

/**
 * Делает цель активной. Если указана заменяемая цель – накопленное
 * с неё переносится на новую, а сама она уходит из списка.
 */
export function activate(p: Profile, goalId: string, replaceId: string | undefined, ctx: Ctx): TransferResult {
  const base: Profile = {
    ...p,
    savedByGoal: { ...p.savedByGoal, [goalId]: savedOn(p, goalId) },
  };
  if (!replaceId) {
    return { profile: { ...base, activeGoalIds: [...p.activeGoalIds, goalId] }, moved: 0, returned: 0 };
  }
  const withNew: Profile = {
    ...base,
    activeGoalIds: p.activeGoalIds.map((id) => (id === replaceId ? goalId : id)),
  };
  return transfer(withNew, replaceId, goalId, ctx);
}

/**
 * Убирает цель из списка. Накопленное – на другую цель (moveToId)
 * или обратно на баланс.
 */
export function remove(p: Profile, goalId: string, moveToId: string | undefined, ctx: Ctx): TransferResult {
  let result: TransferResult = { profile: p, moved: 0, returned: 0 };
  if (savedOn(p, goalId) > 0) {
    if (moveToId) {
      result = transfer(p, goalId, moveToId, ctx);
    } else {
      const back = withdraw(p, goalId, savedOn(p, goalId), ctx);
      result = { profile: back ? back.profile : p, moved: 0, returned: back ? back.amount : 0 };
    }
  }
  return {
    ...result,
    profile: { ...result.profile, activeGoalIds: result.profile.activeGoalIds.filter((id) => id !== goalId) },
  };
}

/* ─────────────────────────── Исполнение мечты ─────────────────────────── */

/** Цель накоплена – «покупаем» её: финкоины уходят из копилки, цель – в исполненные. */
export function achieve(p: Profile, goalId: string, ctx: Ctx): Profile | null {
  const goal = goalById(p, goalId);
  if (!goal || savedOn(p, goalId) < goal.price) return null;
  const spent = savedOn(p, goalId);
  const record: SavingRecord = {
    id: ctx.uid(),
    goalId,
    amount: -spent,
    period: p.period.index,
    at: ctx.now,
    spentOn: `Мечта исполнена: ${goal.title}`,
  };
  return withRecords(
    {
      ...p,
      savedByGoal: { ...p.savedByGoal, [goalId]: 0 },
      activeGoalIds: p.activeGoalIds.filter((id) => id !== goalId),
      achievedGoals: [...p.achievedGoals, { goalId, period: p.period.index, at: ctx.now }],
    },
    [record]
  );
}

/* ─────────────────────── Трата прямо из копилки ─────────────────────── */

/**
 * Оплачивает трату из копилки, начиная с цели, где накоплено больше всего.
 * Возвращает null, если во всей копилке не хватает.
 */
export function spendFromSavings(
  p: Profile,
  amount: number,
  spentOn: string,
  ctx: Ctx
): { profile: Profile; taken: { goalId: string; amount: number }[] } | null {
  if (totalSaved(p) < amount) return null;
  const order = Object.entries(p.savedByGoal)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  let left = amount;
  const taken: { goalId: string; amount: number }[] = [];
  const savedByGoal = { ...p.savedByGoal };
  const records: SavingRecord[] = [];
  for (const [goalId, have] of order) {
    if (left <= 0) break;
    const take = Math.min(have, left);
    savedByGoal[goalId] = have - take;
    left -= take;
    taken.push({ goalId, amount: take });
    records.push({ id: ctx.uid(), goalId, amount: -take, period: p.period.index, at: ctx.now, spentOn });
  }
  return { profile: withRecords({ ...p, savedByGoal }, records), taken };
}
