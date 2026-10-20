/**
 * «Мои финкоины» – история всех операций ребёнка.
 *
 * Откуда финкоины пришли, куда ушли и что отложено в копилку – по неделям,
 * самые свежие сверху. Знак «+» или «−» стоит у каждой суммы, так что
 * направление понятно и без цвета.
 */

import { useMemo, useState } from 'react';

import { Icon, type IconName } from '../components/Icon';
import { Empty, Money, TopBar } from '../components/ui';
import { buildLedger, ledgerTotals, type LedgerEntry, type LedgerKind } from '../engine/ledger';
import { money } from '../engine/economy';
import { useStore } from '../state/store';
import type { Nav } from '../App';

type Filter = 'all' | 'in' | 'out' | 'savings';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Всё' },
  { id: 'in', label: 'Откуда пришли' },
  { id: 'out', label: 'Куда ушли' },
  { id: 'savings', label: 'Копилка' },
];

const MATCH: Record<Filter, (k: LedgerKind) => boolean> = {
  all: () => true,
  in: (k) => k === 'income',
  out: (k) => k === 'spend',
  savings: (k) => k === 'toSavings' || k === 'fromSavings' || k === 'paidFromSavings' || k === 'transfer',
};

const LOOK: Record<LedgerKind, { icon: IconName; tone: string }> = {
  income: { icon: 'plus', tone: 'ledger__icon--in' },
  spend: { icon: 'minus', tone: 'ledger__icon--out' },
  toSavings: { icon: 'piggy', tone: 'ledger__icon--save' },
  fromSavings: { icon: 'piggy', tone: 'ledger__icon--save' },
  paidFromSavings: { icon: 'piggy', tone: 'ledger__icon--save' },
  transfer: { icon: 'transfer', tone: 'ledger__icon--save' },
};

function Row({ e }: { e: LedgerEntry }) {
  const look = LOOK[e.kind];
  // Оплата из копилки не меняет баланс – показываем её со знаком «−» и пометкой.
  // Перенос между целями показываем без знака: финкоины остались в копилке.
  const signed = e.kind === 'paidFromSavings' ? -e.amount : e.kind === 'transfer' ? e.amount : e.balanceDelta;
  return (
    <div className="ledger__row">
      <span className={`ledger__icon ${look.tone}`}>
        <Icon name={look.icon} size={18} />
      </span>
      <span className="ledger__text">
        <b>{e.title}</b>
        {e.detail && <span className="muted">{e.detail}</span>}
      </span>
      <span className={`ledger__sum ${signed > 0 ? 'is-in' : ''}`}>
        <Money value={signed} showCoin={false} sign={e.kind !== 'transfer'} />
      </span>
    </div>
  );
}

export function HistoryScreen({ nav }: { nav: Nav }) {
  const { profile, totalSavings } = useStore();
  const [filter, setFilter] = useState<Filter>('all');

  const ledger = useMemo(() => (profile ? buildLedger(profile) : []), [profile]);
  const totals = useMemo(() => ledgerTotals(ledger), [ledger]);

  if (!profile) return null;

  const visible = ledger.filter((e) => MATCH[filter](e.kind));
  const periods = [...new Set(visible.map((e) => e.period))].sort((a, b) => b - a);

  return (
    <div className="screen">
      <TopBar title="Мои финкоины" subtitle={`Баланс: ${money(profile.balance)}`} onBack={nav.onBack} />

      <section className="card card--hero">
        <div className="ledger__totals">
          <div>
            <span className="muted">Пришло</span>
            <b className="is-in">
              <Money value={totals.income} showCoin={false} sign />
            </b>
          </div>
          <div>
            <span className="muted">Потрачено</span>
            <b>
              <Money value={-totals.spent} showCoin={false} sign />
            </b>
          </div>
          <div>
            <span className="muted">В копилке</span>
            <b>
              <Money value={totalSavings} showCoin={false} />
            </b>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          Каждый финкоин на счету: здесь видно, откуда он пришёл и куда ушёл
        </p>
      </section>

      <div className="chiprow" role="tablist" aria-label="Что показать">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            className={`chip ${filter === f.id ? 'is-on' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Empty
          icon="history"
          title="Пока пусто"
          text={
            filter === 'out'
              ? 'Покупок ещё не было. Загляни в «Покупки», когда составишь план'
              : filter === 'savings'
                ? 'В копилку ещё ничего не откладывали. Даже 10 Φ – уже начало'
                : 'Здесь появятся все начисления и траты'
          }
        />
      ) : (
        periods.map((period) => (
          <section key={period} className="card">
            <div className="card__title">
              <Icon name="calendar" size={18} />
              Неделя {period}
              {period === profile.period.index && <span className="badge">сейчас</span>}
            </div>
            <div className="ledger">
              {visible
                .filter((e) => e.period === period)
                .map((e) => (
                  <Row key={e.id} e={e} />
                ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
