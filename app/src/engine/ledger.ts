/**
 * История финкоинов: все операции в одном списке.
 *
 * Собирается из трёх журналов профиля – начислений, покупок и движений
 * копилки. Главное свойство: сумма изменений баланса по истории всегда
 * равна текущему балансу. Баланс не меняется без объяснения (ТЗ 2.5.4),
 * и ребёнок может сам в этом убедиться.
 */

import type { Profile } from './types';

export type LedgerKind =
  /** Финкоины пришли на баланс. */
  | 'income'
  /** Покупка с баланса. */
  | 'spend'
  /** Перевод с баланса в копилку. */
  | 'toSavings'
  /** Снятие из копилки на баланс. */
  | 'fromSavings'
  /** Трата, оплаченная прямо из копилки, – мимо баланса. */
  | 'paidFromSavings'
  /** Перенос между целями внутри копилки – мимо баланса. */
  | 'transfer';

export interface LedgerEntry {
  id: string;
  at: number;
  period: number;
  kind: LedgerKind;
  title: string;
  /** Пояснение под названием: категория покупки, цель копилки и т. п. */
  detail: string | null;
  /** Сумма операции, всегда положительная. */
  amount: number;
  /** Как операция изменила баланс: «+» пришло, «−» ушло, 0 – мимо баланса. */
  balanceDelta: number;
}

type Source = Pick<Profile, 'incomeLog' | 'purchaseLog' | 'savingsLog' | 'goals'>;

/** Все операции, самые свежие – сверху. */
export function buildLedger(p: Source): LedgerEntry[] {
  const goalTitle = (id: string) => p.goals.find((g) => g.id === id)?.title ?? 'цель';
  const entries: (LedgerEntry & { order: number })[] = [];
  let order = 0;

  for (const r of p.incomeLog) {
    entries.push({
      id: r.id,
      at: r.at,
      period: r.period,
      kind: 'income',
      title: r.source,
      detail: null,
      amount: r.amount,
      balanceDelta: r.amount,
      order: order++,
    });
  }

  for (const r of p.purchaseLog) {
    entries.push({
      id: r.id,
      at: r.at,
      period: r.period,
      kind: 'spend',
      title: r.title,
      detail: r.kind === 'needs' ? 'Обязательное' : 'Желаемое',
      amount: r.price,
      balanceDelta: -r.price,
      order: order++,
    });
  }

  for (const r of p.savingsLog) {
    const goal = goalTitle(r.goalId);
    // Перенос записан двумя строками; показываем одну – списание с указанием, куда.
    if (r.movedFrom) continue;
    if (r.movedTo) {
      entries.push({
        id: r.id,
        at: r.at,
        period: r.period,
        kind: 'transfer',
        title: 'Перенесено на другую цель',
        detail: `«${goal}» → «${goalTitle(r.movedTo)}»`,
        amount: -r.amount,
        balanceDelta: 0,
        order: order++,
      });
      continue;
    }
    if (r.spentOn) {
      entries.push({
        id: r.id,
        at: r.at,
        period: r.period,
        kind: 'paidFromSavings',
        title: r.spentOn,
        detail: `Оплачено из копилки «${goal}»`,
        amount: -r.amount,
        balanceDelta: 0,
        order: order++,
      });
    } else if (r.amount > 0) {
      entries.push({
        id: r.id,
        at: r.at,
        period: r.period,
        kind: 'toSavings',
        title: 'Отложено в копилку',
        detail: `Цель «${goal}»`,
        amount: r.amount,
        balanceDelta: -r.amount,
        order: order++,
      });
    } else {
      entries.push({
        id: r.id,
        at: r.at,
        period: r.period,
        kind: 'fromSavings',
        title: 'Снято из копилки',
        detail: `Цель «${goal}»`,
        amount: -r.amount,
        balanceDelta: -r.amount,
        order: order++,
      });
    }
  }

  return entries
    .sort((a, b) => b.at - a.at || b.order - a.order)
    .map(({ order: _order, ...e }) => e);
}

/** Итоги по истории – для шапки экрана. */
export function ledgerTotals(entries: LedgerEntry[]) {
  let income = 0;
  let spent = 0;
  let saved = 0;
  for (const e of entries) {
    if (e.kind === 'income') income += e.amount;
    if (e.kind === 'spend') spent += e.amount;
    if (e.kind === 'toSavings') saved += e.amount;
    if (e.kind === 'fromSavings' || e.kind === 'paidFromSavings') saved -= e.amount;
  }
  return { income, spent, saved };
}
