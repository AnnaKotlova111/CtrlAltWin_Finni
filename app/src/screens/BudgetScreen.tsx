/**
 * План личного бюджета.
 *
 * До начала недели ребёнок распределяет доступную сумму по трём
 * направлениям. Приложение следит, чтобы распределение не превышало
 * бюджет, и показывает остаток. После подтверждения экран превращается
 * в сравнение плана с фактом.
 */

import { useMemo, useState } from 'react';

import { Icon } from '../components/Icon';
import { Confirm, HintBlock, Money, QuickAmounts, Stepper, TopBar } from '../components/ui';
import { CHEAPEST_NEED } from '../content/shop';
import { budgetMood, budgetRemark } from '../content/remarks';
import { PetSpeech } from '../components/PetSpeech';
import {
  DIRECTIONS,
  DIRECTION_HINTS,
  DIRECTION_TITLES,
  allocationTotal,
  checkPlan,
  money,
} from '../engine/economy';
import { planVsFact } from '../engine/period';
import { useStore } from '../state/store';
import type { Nav } from '../App';
import type { Allocation, Direction } from '../engine/types';

const DIR_ICON: Record<Direction, 'bowl' | 'ball' | 'piggy'> = {
  needs: 'bowl',
  wants: 'ball',
  savings: 'piggy',
};

const STEP = 10;

export function BudgetScreen({ nav }: { nav: Nav }) {
  const { profile, dispatch } = useStore();
  const [confirm, setConfirm] = useState(false);

  const income = profile?.period.income ?? 0;
  const [draft, setDraft] = useState<Allocation>(
    () => profile?.period.plan ?? { needs: 0, wants: 0, savings: 0 }
  );

  const check = useMemo(() => checkPlan(draft, income, CHEAPEST_NEED.price), [draft, income]);
  if (!profile) return null;

  const { period } = profile;

  /* ── Режим сравнения: план уже подтверждён ── */
  if (period.planConfirmed && period.plan) {
    const rows = planVsFact(period.plan, period.fact);
    const spent = allocationTotal(period.fact);
    return (
      <div className="screen">
        <TopBar title="План и факт" subtitle={`Неделя ${period.index}`} onBack={nav.onBack} />

        <section className="card card--hero card--tight">
          <span className="muted">Доступно на неделю</span>
          <div style={{ marginTop: 2 }}>
            <Money value={period.income} big />
          </div>
          <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>
            Уже использовано {money(spent)}. На балансе {money(profile.balance)}
          </p>
        </section>

        <section className="card">
          <div className="card__title">
            <Icon name="budget" size={20} />
            Сравнение
          </div>
          <div className="stack--tight stack" style={{ marginTop: 6 }}>
            {rows.map((r) => {
              const over = r.diff > 0;
              const pct = r.planned > 0 ? Math.min(140, (r.actual / r.planned) * 100) : r.actual > 0 ? 140 : 0;
              return (
                <div key={r.key} className="pfrow">
                  <div className="row row--between">
                    <span className="row" style={{ gap: 7 }}>
                      <Icon name={DIR_ICON[r.key]} size={17} />
                      <b>{DIRECTION_TITLES[r.key]}</b>
                    </span>
                    <span className="muted">
                      план <Money value={r.planned} showCoin={false} />
                    </span>
                  </div>
                  <div className="bar" style={{ marginTop: 6 }}>
                    <div
                      className="bar__fill"
                      style={{
                        width: `${Math.min(100, pct)}%`,
                        background: over ? 'var(--red)' : 'var(--green)',
                      }}
                    />
                  </div>
                  <div className="row row--between" style={{ marginTop: 5 }}>
                    <span className="muted">
                      факт <Money value={r.actual} showCoin={false} />
                    </span>
                    <span className={`badge ${over ? 'badge--warn' : 'badge--needs'}`}>
                      <Icon name={over ? 'warning' : 'check'} size={16} />
                      {over ? `больше на ${money(r.diff)}` : r.diff === 0 ? 'ровно по плану' : `меньше на ${money(-r.diff)}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <HintBlock title="Почему план важнее, чем кажется">
          План – это обещание самому себе. Когда факт совпадает с планом, питомец получает
          очки развития. Если не совпал – ничего страшного: прогресс сохраняется, а следующий
          план можно сделать точнее
        </HintBlock>

        <button className="btn btn--secondary" onClick={() => nav.go({ name: 'shop' })}>
          Перейти к покупкам
        </button>
      </div>
    );
  }

  /* ── Режим составления плана ── */
  const rest = check.rest;
  const total = allocationTotal(draft);
  const remark = budgetRemark(budgetMood(draft, income), profile.pet.species);

  const setDir = (dir: Direction, value: number) => {
    const others = total - draft[dir];
    const max = income - others;
    setDraft({ ...draft, [dir]: Math.max(0, Math.min(max, value)) });
  };

  const autoFill = () => {
    // Подсказка-заготовка: половина на обязательное, четверть на желаемое, четверть в копилку.
    const needs = Math.round((income * 0.5) / STEP) * STEP;
    const wants = Math.round((income * 0.25) / STEP) * STEP;
    setDraft({ needs, wants, savings: income - needs - wants });
  };

  return (
    <div className="screen">
      <TopBar title="План бюджета" subtitle={`Неделя ${period.index}`} onBack={nav.onBack} />

      <section className="card card--hero">
        <span className="muted">Доступно на неделю</span>
        <div style={{ marginTop: 2 }}>
          <Money value={income} big />
        </div>
        <div className="row row--between" style={{ marginTop: 12 }}>
          <span className="muted">Не распределено</span>
          <span className={`badge ${rest === 0 ? 'badge--needs' : rest < 0 ? 'badge--warn' : 'badge--gold'}`}>
            <Icon name={rest === 0 ? 'check' : rest < 0 ? 'warning' : 'coin'} size={16} />
            <Money value={rest} showCoin={false} sign={rest < 0} />
          </span>
        </div>
        <div className="bar" style={{ marginTop: 8 }}>
          <div
            className="bar__fill"
            style={{
              width: `${Math.min(100, (total / Math.max(1, income)) * 100)}%`,
              background: rest < 0 ? 'var(--red)' : 'var(--purple)',
            }}
          />
        </div>
        <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>
          Сумму можно набрать с клавиатуры – нажми на число между «−» и «+»
        </p>
      </section>

      {/* Питомец реагирует на распределение в своём характере – на каждом шаге. */}
      <PetSpeech line={remark.says} note={remark.note} size={60} live />

      <div className="stack--tight stack">
        {DIRECTIONS.map((dir) => (
          <section key={dir} className="card">
            <div className="row" style={{ gap: 10 }}>
              <span className={`decision__icon decision__icon--${dir}`}>
                <Icon name={DIR_ICON[dir]} size={22} />
              </span>
              <span className="linkrow__text">
                <b>{DIRECTION_TITLES[dir]}</b>
                <span className="muted">{DIRECTION_HINTS[dir]}</span>
              </span>
            </div>
            <div style={{ marginTop: 12 }}>
              <Stepper
                value={draft[dir]}
                step={STEP}
                max={income - (total - draft[dir])}
                onChange={(v) => setDir(dir, v)}
                label={DIRECTION_TITLES[dir]}
              />
              <QuickAmounts
                value={draft[dir]}
                max={income - (total - draft[dir])}
                onChange={(v) => setDir(dir, v)}
                label={DIRECTION_TITLES[dir]}
              />
            </div>
          </section>
        ))}
      </div>

      {check.problem && (
        <div className="notice notice--warn">
          <Icon name="warning" size={20} />
          <span>
            <b>{check.problem}</b>
            {check.advice && <span className="muted"> {check.advice}</span>}
          </span>
        </div>
      )}

      <HintBlock title="Как распределить?">
        Сначала посчитай обязательное: еда и уход. Самая дешёвая обязательная покупка стоит{' '}
        {money(CHEAPEST_NEED.price)}. Потом отложи в копилку – хотя бы немного. Всё, что
        осталось, можно потратить на желаемое
      </HintBlock>

      <button className="btn btn--ghost" onClick={autoFill}>
        Подсказать распределение
      </button>

      <button className="btn" disabled={!check.ok} onClick={() => setConfirm(true)}>
        Подтвердить план
      </button>
      <p className="muted center">План можно менять сколько угодно – до подтверждения</p>

      <Confirm
        open={confirm}
        title="Подтвердить план?"
        confirmLabel="Подтвердить"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          dispatch({ type: 'plan/draft', allocation: draft });
          dispatch({ type: 'plan/confirm' });
        }}
      >
        Обязательное – {money(draft.needs)}, желаемое – {money(draft.wants)}, в копилку –{' '}
        {money(draft.savings)}. После подтверждения план фиксируется, и в конце недели мы
        сравним его с фактом
      </Confirm>
    </div>
  );
}
