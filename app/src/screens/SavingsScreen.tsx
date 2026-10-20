/**
 * Копилка: можно копить сразу на несколько целей.
 *
 *  • У каждой цели своя сумма и свой прогресс.
 *  • При выборе новой цели ребёнок решает: копить на все сразу или заменить
 *    одну из текущих – тогда накопленное переходит на новую цель.
 *  • Пополняя копилку, ребёнок сам раскладывает сумму по целям.
 *  • Снимать можно только с конкретной цели: сразу видно, какая мечта
 *    отодвинется и на сколько. Снятие подтверждается отдельно.
 *  • Накопленную цель можно «исполнить» – она уходит в «Исполненные мечты».
 */

import { useState } from 'react';

import { Icon } from '../components/Icon';
import { PetSpeech } from '../components/PetSpeech';
import { Confirm, Money, Sheet, Stepper, Thumb, TopBar } from '../components/ui';
import { CUSTOM_GOAL_PRICES, CUSTOM_GOAL_TITLES } from '../content/goals';
import { savingsMood, savingsRemark } from '../content/remarks';
import {
  CUSTOM_GOAL_MAX_PRICE,
  CUSTOM_GOAL_MIN_PRICE,
  CUSTOM_GOAL_TITLE_MAX,
  INCOME_REGULAR,
  MAX_ACTIVE_GOALS,
  NEEDS_RESERVE,
} from '../engine/constants';
import {
  FAR_AWAY_PERIODS,
  money,
  needsReserve,
  weeksAfter,
  weeksWord,
  savingsForecast,
  suggestedPace,
} from '../engine/economy';
import { contributionsByPeriod } from '../engine/savings';
import { useStore } from '../state/store';
import type { Nav } from '../App';
import type { Goal } from '../engine/types';

const STEP = 10;

/** Суммы для прикидки «а если откладывать по…» – те же, что в быстрых кнопках. */
const TRY_AMOUNTS = [20, 50, 100];



/** Цель, которую выбрали в списке или придумали, – ждёт решения «копить на все или заменить». */
type Pending =
  | { kind: 'existing'; goal: Goal }
  | { kind: 'new'; title: string; price: number; icon: string };

/**
 * Что будет, если откладывать столько каждую неделю.
 *
 * Ребёнок крутит сумму и тут же видит ответ: больше кладёшь – ближе цель.
 * Это главное, что должно остаться в голове после экрана копилки.
 */
function DepositPreview({
  amount,
  remaining,
  title,
}: {
  amount: number;
  remaining: number;
  title: string;
}) {
  if (amount <= 0 || remaining <= 0) return null;
  const periods = Math.ceil(remaining / amount);
  const advice = suggestedPace(remaining, INCOME_REGULAR);
  const advicePeriods = Math.ceil(remaining / advice);
  const slow = periods > FAR_AWAY_PERIODS && advice > amount;

  return (
    <div className="savecalc">
      <div className="savecalc__line">
        <Icon name="calendar" size={18} />
        <span>
          Если откладывать столько каждую неделю – «{title}» через <b>{periods}</b>{' '}
          {weeksAfter(periods)}
        </span>
      </div>
      {slow && (
        <p className="savecalc__hint">
          По {money(amount)} копить долго. А по {money(advice)} – цель будет твоей через{' '}
          {advicePeriods} {weeksAfter(advicePeriods)}
        </p>
      )}
    </div>
  );
}

/**
 * Срок до цели – одной фразой.
 *
 * Темп берётся настоящий, по пополнениям ребёнка. Если он такой, что цель
 * почти не двигается, вместо огромного числа игра подсказывает сумму,
 * с которой цель станет достижимой: ребёнку нужен следующий шаг, а не
 * сообщение «осталось 258 недель».
 */
function Eta({
  remaining,
  byPeriod,
}: {
  remaining: number;
  byPeriod: { period: number; amount: number }[];
}) {
  const f = savingsForecast(remaining, byPeriod);
  const advice = suggestedPace(remaining, INCOME_REGULAR);
  const advicePeriods = Math.ceil(remaining / advice);

  if (!f || f.periods > FAR_AWAY_PERIODS) {
    return (
      <span className="muted">
        Если откладывать по {money(advice)} за неделю, цель будет твоей примерно через{' '}
        <b>{advicePeriods}</b> {weeksAfter(advicePeriods)}
      </span>
    );
  }

  return (
    <span className="muted">
      В копилку уходит по {money(f.pace)} за неделю – цель будет твоей примерно через{' '}
      <b>{f.periods}</b> {weeksAfter(f.periods)}
    </span>
  );
}

/** Карточка одной цели: прогресс, срок, «исполнить» и «убрать». */
function GoalCard({
  goal,
  saved,
  byPeriod,
  onRemove,
  onAchieve,
  onTry,
}: {
  goal: Goal;
  saved: number;
  byPeriod: { period: number; amount: number }[];
  onRemove: () => void;
  onAchieve: () => void;
  onTry: (amount: number) => void;
}) {
  const remaining = Math.max(0, goal.price - saved);
  const reached = remaining === 0;
  return (
    <section className="card card--hero">
      <div className="row" style={{ gap: 12 }}>
        <Thumb icon={goal.icon} tone="gold" />
        <span className="linkrow__text">
          <b style={{ fontSize: 'var(--fs-lg)' }}>{goal.title}</b>
          <span className="muted">{goal.hint}</span>
        </span>
        <button className="iconbtn iconbtn--ghost" onClick={onRemove} aria-label={`Убрать цель «${goal.title}»`}>
          <Icon name="close" size={18} />
        </button>
      </div>

      {/* Накоплено, стоимость и доля – одной строкой: так видно сразу,
          и карточка не растёт в высоту. */}
      <div className="goalnums">
        <b className="goalnums__now">
          <Money value={saved} />
        </b>
        <span className="muted">
          из <Money value={goal.price} showCoin={false} />
        </span>
        <span className="goalnums__pct">{Math.round((saved / goal.price) * 100)} %</span>
      </div>

      <div className="bar" style={{ marginTop: 8 }}>
        <div
          className="bar__fill"
          style={{ width: `${Math.min(100, (saved / goal.price) * 100)}%`, background: 'var(--green)' }}
        />
      </div>

      {reached ? (
        <div className="stack--tight stack" style={{ marginTop: 12 }}>
          <span className="badge badge--needs" style={{ alignSelf: 'flex-start' }}>
            <Icon name="check" size={16} />
            Цель накоплена!
          </span>
          <button className="btn" onClick={onAchieve}>
            <Icon name="trophy" size={20} />
            Исполнить мечту
          </button>
        </div>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 8 }}>
            Осталось накопить <b>{money(remaining)}</b>
          </p>
          <div style={{ marginTop: 4 }}>
            <Eta remaining={remaining} byPeriod={byPeriod} />
          </div>

          {/* Зависимость «больше откладываешь – ближе цель» показываем готовыми
              вариантами: так её видно без единого нажатия. Нажатие подставляет
              сумму в пополнение – от мысли сразу к действию. */}
          <div className="whatif">
            <span className="whatif__cap">А если откладывать</span>
            <div className="whatif__row">
              {TRY_AMOUNTS.map((v) => {
                const periods = Math.ceil(remaining / v);
                return (
                  <button key={v} className="whatif__item" onClick={() => onTry(v)}>
                    <b>по {money(v)}</b>
                    <span>
                      {periods} {weeksWord(periods)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export function SavingsScreen({ nav }: { nav: Nav }) {
  const { profile, dispatch, activeGoals, totalSavings } = useStore();
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [withdrawGoalId, setWithdrawGoalId] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [askWithdraw, setAskWithdraw] = useState(false);
  const [picker, setPicker] = useState(false);
  const [builder, setBuilder] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [removing, setRemoving] = useState<Goal | null>(null);
  const [achieving, setAchieving] = useState<Goal | null>(null);
  const [hint, setHint] = useState(false);

  if (!profile) return null;

  const log = profile.savingsLog;
  const saved = (id: string) => profile.savedByGoal[id] ?? 0;

  /*
   * Темп для прикидки срока своей цели – по всем целям сразу.
   * Если пополнений ещё не было, темпа нет: раньше здесь подставлялись
   * выдуманные 100 Φ, и срок выглядел настоящим, хотя был взят с потолка.
   */
  const paceByPeriod = contributionsByPeriod(log);
  const pace = paceByPeriod.length
    ? Math.round(
        paceByPeriod.slice(-3).reduce((s, p) => s + p.amount, 0) /
          Math.min(3, paceByPeriod.length)
      )
    : 0;

  // Сколько нельзя уносить в копилку: обязательное этой недели.
  const reserve = needsReserve(
    profile.period.planConfirmed ? profile.period.plan : null,
    profile.period.fact.needs,
    NEEDS_RESERVE
  );

  const atLimit = activeGoals.length >= MAX_ACTIVE_GOALS;
  const openGoals = activeGoals.filter((x) => x.saved < x.goal.price);
  const goalsWithMoney = activeGoals.filter((x) => x.saved > 0);

  /* ── пополнение: сумма по каждой цели ── */
  const depositTotal = openGoals.reduce((s, x) => s + (amounts[x.goal.id] ?? 0), 0);
  const balanceAfter = profile.balance - depositTotal;
  const needsWarning = depositTotal > 0 && balanceAfter < reserve;
  const maxFor = (goal: Goal) =>
    Math.max(0, Math.min(goal.price - saved(goal.id), profile.balance - (depositTotal - (amounts[goal.id] ?? 0))));
  const setAmount = (id: string, v: number) => setAmounts((a) => ({ ...a, [id]: v }));

  /* ── снятие: с конкретной цели ── */
  const wItem = goalsWithMoney.find((x) => x.goal.id === withdrawGoalId) ?? goalsWithMoney[0] ?? null;
  const wAmount = wItem ? Math.min(withdrawAmount, wItem.saved) : 0;
  const wContrib = wItem ? contributionsByPeriod(log, wItem.goal.id) : [];
  const etaNow = wItem ? savingsForecast(wItem.goal.price - wItem.saved, wContrib) : null;
  const etaAfter = wItem ? savingsForecast(wItem.goal.price - (wItem.saved - wAmount), wContrib) : null;

  const remark = savingsRemark(
    savingsMood(activeGoals.map((x) => ({ price: x.goal.price, saved: x.saved }))),
    profile.pet.species
  );

  /* ── выбор новой цели ── */
  const achievedIds = new Set(profile.achievedGoals.map((a) => a.goalId));
  const available = profile.goals.filter((g) => !profile.activeGoalIds.includes(g.id) && !achievedIds.has(g.id));

  const confirmAdd = (what: Pending, replaceId?: string) => {
    if (what.kind === 'existing') dispatch({ type: 'goal/add', goalId: what.goal.id, replaceId });
    else dispatch({ type: 'goal/create', title: what.title, price: what.price, icon: what.icon, replaceId });
    setPending(null);
    setAmounts({});
  };

  const startAdding = (what: Pending) => {
    setPicker(false);
    setBuilder(false);
    // Целей ещё нет – спрашивать нечего.
    if (activeGoals.length === 0) confirmAdd(what);
    else setPending(what);
  };

  const pendingTitle = pending ? (pending.kind === 'existing' ? pending.goal.title : pending.title) : '';
  const pendingRoom = pending
    ? pending.kind === 'existing'
      ? pending.goal.price - saved(pending.goal.id)
      : pending.price
    : 0;

  return (
    <div className="screen">
      <TopBar
        title="Моя копилка"
        subtitle={`Баланс: ${money(profile.balance)}`}
        onBack={nav.onBack}
        right={
          <button
            className="iconbtn iconbtn--ghost"
            onClick={() => setHint(true)}
            aria-label="Как устроена копилка"
          >
            <Icon name="info" size={24} />
          </button>
        }
      />

      {/* Питомец и подсказка стоят сразу под шапкой: сначала объяснение,
          зачем всё это, и только потом цифры. */}
      <PetSpeech line={remark.says} note={remark.note} size={60} live />

      {activeGoals.length === 0 ? (
        <section className="card card--hero center stack">
          <Icon name="target" size={46} style={{ margin: '0 auto' }} />
          <h3>Выбери цель</h3>
          <p className="muted">
            Копить интереснее, когда понятно, ради чего. Выбери готовую цель или собери свою
          </p>
          <button className="btn" onClick={() => setPicker(true)}>
            Выбрать цель
          </button>
        </section>
      ) : (
        <>
          <div className="sumline">
            <Icon name="piggy" size={20} />
            <span>Всего в копилке</span>
            <b>
              <Money value={totalSavings} showCoin={false} />
            </b>
          </div>

          <div className="listcap">
            <Icon name="target" size={18} />
            <span>Мои цели</span>
            <span className="muted">
              {activeGoals.length} из {MAX_ACTIVE_GOALS}
            </span>
          </div>
        </>
      )}

      <div className="stack stack--cols">
        {activeGoals.map(({ goal, saved: s }) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            saved={s}
            byPeriod={contributionsByPeriod(log, goal.id)}
            onRemove={() => setRemoving(goal)}
            onAchieve={() => setAchieving(goal)}
            onTry={(v) => setAmount(goal.id, Math.min(maxFor(goal), v))}
          />
        ))}
      </div>

      {activeGoals.length > 0 && (
        <button className="btn btn--secondary" onClick={() => setPicker(true)}>
          <Icon name="plus" size={18} />
          {atLimit ? 'Заменить цель новой' : 'Добавить ещё цель'}
        </button>
      )}

      {/* ── Пополнение ── */}
      {openGoals.length > 0 && (
        <section className="card">
          <div className="card__title">
            <Icon name="plus" size={20} style={{ color: 'var(--green)' }} />
            Отложить в копилку
          </div>
          <p className="muted">
            {openGoals.length > 1
              ? 'Реши, сколько положить на каждую цель. Сумма уйдёт с баланса'
              : 'Сумма уйдёт с баланса и будет учитываться отдельно'}
          </p>
          <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
            Сумму можно набрать с клавиатуры – нажми на число между «−» и «+»
          </p>

          <div className="stack--tight stack" style={{ marginTop: 12 }}>
            {openGoals.map(({ goal }) => (
              <div key={goal.id} className={openGoals.length > 1 ? 'depositrow' : undefined}>
                {openGoals.length > 1 && (
                  <div className="row row--between" style={{ marginBottom: 6 }}>
                    <b>{goal.title}</b>
                    <span className="muted">осталось {money(goal.price - saved(goal.id))}</span>
                  </div>
                )}
                <Stepper
                  value={amounts[goal.id] ?? 0}
                  step={STEP}
                  max={maxFor(goal)}
                  onChange={(v) => setAmount(goal.id, v)}
                  label={`На цель «${goal.title}»`}
                />
                <DepositPreview
                  amount={amounts[goal.id] ?? 0}
                  remaining={goal.price - saved(goal.id)}
                  title={goal.title}
                />
              </div>
            ))}
          </div>

          {openGoals.length === 1 && (
            <div className="chiprow" style={{ marginTop: 10 }}>
              {[20, 50, 100].map((v) => {
                const g = openGoals[0].goal;
                return (
                  <button key={v} className="chip" onClick={() => setAmount(g.id, Math.min(maxFor(g), v))} disabled={maxFor(g) < v}>
                    {v} Φ
                  </button>
                );
              })}
              <button
                className="chip"
                onClick={() => setAmount(openGoals[0].goal.id, maxFor(openGoals[0].goal))}
                disabled={maxFor(openGoals[0].goal) === 0}
              >
                до цели
              </button>
            </div>
          )}

          {openGoals.length > 1 && depositTotal > 0 && (
            <p className="muted" style={{ marginTop: 10 }}>
              Всего отложишь {money(depositTotal)}, на балансе останется {money(profile.balance - depositTotal)}
            </p>
          )}

          {/* Откладывать всё до копейки не запрещаем – показываем последствие.
              Запрет решал бы за ребёнка, а так он видит связь копилки и питомца. */}
          {needsWarning && (
            <div className="notice notice--warn" style={{ marginTop: 12 }}>
              <Icon name="warning" size={18} />
              <span>
                {balanceAfter <= 0
                  ? `Если отложить всё, на еду не останется ничего – питомец проголодается`
                  : `На балансе останется ${money(balanceAfter)}, а на еду и уход нужно ещё ${money(reserve)} – питомцу не хватит`}
              </span>
            </div>
          )}

          <button
            className="btn"
            style={{ marginTop: 12 }}
            disabled={depositTotal <= 0 || depositTotal > profile.balance}
            onClick={() => {
              dispatch({ type: 'savings/deposit', amounts });
              setAmounts({});
            }}
          >
            Отложить <Money value={depositTotal} showCoin={false} />
          </button>
        </section>
      )}

      {/* ── Снятие ── */}
      {wItem && (
        <section className="card">
          <div className="card__title">
            <Icon name="minus" size={20} style={{ color: 'var(--red)' }} />
            Снять из копилки
          </div>
          <p className="muted">
            Снимать можно только с конкретной цели – так видно, какая мечта отодвинется.
            Поэтому снятие подтверждается отдельно
          </p>
          {goalsWithMoney.length > 1 && (
            <>
              <span className="label" style={{ marginTop: 12 }}>
                С какой цели
              </span>
              <div className="chiprow">
                {goalsWithMoney.map(({ goal, saved: s }) => (
                  <button
                    key={goal.id}
                    className={`chip ${goal.id === wItem.goal.id ? 'is-on' : ''}`}
                    aria-pressed={goal.id === wItem.goal.id}
                    onClick={() => {
                      setWithdrawGoalId(goal.id);
                      setWithdrawAmount(0);
                    }}
                  >
                    {goal.title} · {money(s)}
                  </button>
                ))}
              </div>
            </>
          )}
          <div style={{ marginTop: 12 }}>
            <Stepper
              value={wAmount}
              step={STEP}
              max={wItem.saved}
              onChange={setWithdrawAmount}
              label={`Снять с цели «${wItem.goal.title}»`}
            />
          </div>
          <button
            className="btn btn--secondary"
            style={{ marginTop: 12 }}
            disabled={wAmount <= 0}
            onClick={() => setAskWithdraw(true)}
          >
            Снять <Money value={wAmount} showCoin={false} />
          </button>
        </section>
      )}

      {/* ── Исполненные мечты ── */}
      {profile.achievedGoals.length > 0 && (
        <section className="card">
          <div className="card__title">
            <Icon name="trophy" size={20} style={{ color: 'var(--gold-dark)' }} />
            Исполненные мечты
          </div>
          <div className="stack--tight stack" style={{ marginTop: 6 }}>
            {[...profile.achievedGoals].reverse().map((a) => {
              const g = profile.goals.find((x) => x.id === a.goalId);
              if (!g) return null;
              return (
                <div key={`${a.goalId}-${a.at}`} className="row" style={{ gap: 12 }}>
                  <Thumb icon={g.icon} tone="gold" />
                  <span className="linkrow__text">
                    <b>{g.title}</b>
                    <span className="muted">
                      {money(g.price)} · исполнена на неделе {a.period}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Выбор цели ── */}
      <Sheet open={hint} onClose={() => setHint(false)} title="Как устроена копилка">
        <p>
          Копить можно сразу на несколько целей – до {MAX_ACTIVE_GOALS}. У каждой свой прогресс и
          свой срок
        </p>
        <p style={{ marginTop: 10 }}>
          Когда пополняешь копилку, ты решаешь, сколько положить на каждую цель
        </p>
        <p style={{ marginTop: 10 }}>
          Срок считается по пополнениям этой цели: берём среднее и делим на него то, что осталось
        </p>
      </Sheet>

      <Sheet open={picker} onClose={() => setPicker(false)} title="Новая цель">
        <div className="stack--tight stack">
          {atLimit && (
            <p className="muted">
              Сейчас у тебя {MAX_ACTIVE_GOALS} цели – новая заменит одну из них
            </p>
          )}
          {available.map((g) => (
            <button key={g.id} className="linkrow linkrow--card" onClick={() => startAdding({ kind: 'existing', goal: g })}>
              <Thumb icon={g.icon} tone="gold" />
              <span className="linkrow__text">
                <b>{g.title}</b>
                <span className="muted">{money(g.price)}</span>
              </span>
              <Icon name="back" size={18} style={{ transform: 'rotate(180deg)', color: 'var(--ink-mute)' }} />
            </button>
          ))}
          <button
            className="btn btn--ghost"
            onClick={() => {
              setPicker(false);
              setBuilder(true);
            }}
          >
            <Icon name="plus" size={18} />
            Собрать свою цель
          </button>
        </div>
      </Sheet>

      {/* ── Конструктор своей цели ── */}
      <Sheet open={builder} onClose={() => setBuilder(false)} title="Своя цель">
        <GoalBuilder
          pace={pace}
          onCreate={(title, price, icon) => startAdding({ kind: 'new', title, price, icon })}
        />
      </Sheet>

      {/* ── На все цели сразу или заменить? ── */}
      <Sheet open={pending !== null} onClose={() => setPending(null)} title={`Новая цель: ${pendingTitle}`}>
        {pending && (
          <div className="stack--tight stack">
            <p>
              {activeGoals.length === 1
                ? `Ты уже копишь на «${activeGoals[0].goal.title}». Как поступим?`
                : `Ты уже копишь на ${activeGoals.length} цели. Как поступим?`}
            </p>
            {atLimit ? (
              <p className="muted">
                Одновременно можно копить не больше чем на {MAX_ACTIVE_GOALS} цели, поэтому новая
                заменит одну из них
              </p>
            ) : (
              <button className="optionrow optionrow--card" onClick={() => confirmAdd(pending)}>
                <span className="optionrow__text">
                  <b>{activeGoals.length === 1 ? 'Копить на обе цели' : 'Копить на все цели сразу'}</b>
                  <span className="muted">
                    У каждой цели будет свой прогресс. Уже накопленное останется там, где лежит
                  </span>
                </span>
                <Icon name="plus" size={18} />
              </button>
            )}
            {activeGoals.map(({ goal, saved: s }) => (
              <button key={goal.id} className="optionrow optionrow--card" onClick={() => confirmAdd(pending, goal.id)}>
                <span className="optionrow__text">
                  <b>Заменить «{goal.title}»</b>
                  <span className="muted">
                    {s === 0
                      ? `«${goal.title}» уберём из списка, копить будем на новую цель`
                      : s <= pendingRoom
                        ? `Накопленные ${money(s)} перейдут на новую цель`
                        : `Новая цель дешевле: на неё перейдут ${money(pendingRoom)}, остальные ${money(s - pendingRoom)} вернутся на баланс`}
                  </span>
                </span>
                <Icon name="transfer" size={18} />
              </button>
            ))}
            <button className="btn btn--secondary" style={{ marginTop: 6 }} onClick={() => setPending(null)}>
              Отмена
            </button>
          </div>
        )}
      </Sheet>

      {/* ── Убрать цель: куда деть накопленное ── */}
      <Sheet open={removing !== null} onClose={() => setRemoving(null)} title={removing ? `Убрать «${removing.title}»?` : ''}>
        {removing && (
          <div className="stack--tight stack">
            {saved(removing.id) === 0 ? (
              <>
                <p>Цель уберём из списка. Её всегда можно выбрать снова</p>
                <div className="btn-row" style={{ marginTop: 6 }}>
                  <button className="btn btn--secondary" onClick={() => setRemoving(null)}>
                    Отмена
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      dispatch({ type: 'goal/remove', goalId: removing.id });
                      setRemoving(null);
                    }}
                  >
                    Убрать
                  </button>
                </div>
              </>
            ) : (
              <>
                <p>На этой цели накоплено {money(saved(removing.id))}. Куда их деть?</p>
                {activeGoals
                  .filter((x) => x.goal.id !== removing.id)
                  .map(({ goal, saved: s }) => {
                    const room = goal.price - s;
                    const have = saved(removing.id);
                    return (
                      <button
                        key={goal.id}
                        className="optionrow optionrow--card"
                        disabled={room <= 0}
                        onClick={() => {
                          dispatch({ type: 'goal/remove', goalId: removing.id, moveToId: goal.id });
                          setRemoving(null);
                        }}
                      >
                        <span className="optionrow__text">
                          <b>Перенести на «{goal.title}»</b>
                          <span className="muted">
                            {room <= 0
                              ? 'Эта цель уже накоплена'
                              : have <= room
                                ? `Станет ${money(s + have)} из ${money(goal.price)}`
                                : `Поместится ${money(room)}, остальные ${money(have - room)} вернутся на баланс`}
                          </span>
                        </span>
                        <Icon name="transfer" size={18} />
                      </button>
                    );
                  })}
                <button
                  className="optionrow optionrow--card"
                  onClick={() => {
                    dispatch({ type: 'goal/remove', goalId: removing.id });
                    setRemoving(null);
                  }}
                >
                  <span className="optionrow__text">
                    <b>Вернуть на баланс</b>
                    <span className="muted">Финкоины снова можно будет потратить или отложить</span>
                  </span>
                  <Icon name="coin" size={18} />
                </button>
                <button className="btn btn--secondary" style={{ marginTop: 6 }} onClick={() => setRemoving(null)}>
                  Отмена
                </button>
              </>
            )}
          </div>
        )}
      </Sheet>

      {/* ── Исполнить мечту ── */}
      <Confirm
        open={achieving !== null}
        title={achieving ? `Исполнить мечту «${achieving.title}»?` : ''}
        confirmLabel="Исполнить"
        onCancel={() => setAchieving(null)}
        onConfirm={() => {
          if (achieving) dispatch({ type: 'goal/achieve', goalId: achieving.id });
          setAchieving(null);
        }}
      >
        {achieving && (
          <>
            Вся сумма – {money(achieving.price)} – накоплена. Финкоины из копилки уйдут на эту мечту,
            а она попадёт в «Исполненные мечты». В копилке освободится место для новой цели
          </>
        )}
      </Confirm>

      {/* ── Подтверждение снятия ── */}
      <Confirm
        open={askWithdraw && !!wItem}
        title="Снять из копилки?"
        confirmLabel="Снять"
        danger
        onCancel={() => setAskWithdraw(false)}
        onConfirm={() => {
          if (wItem) dispatch({ type: 'savings/withdraw', goalId: wItem.goal.id, amount: wAmount });
          setWithdrawAmount(0);
          setAskWithdraw(false);
        }}
      >
        {wItem && (
          <div className="stack--tight stack">
            <div className="row row--between">
              <span>Цель</span>
              <b>{wItem.goal.title}</b>
            </div>
            <div className="row row--between">
              <span>Накоплено сейчас</span>
              <Money value={wItem.saved} showCoin={false} />
            </div>
            <div className="row row--between">
              <span>Станет после снятия</span>
              <b>
                <Money value={wItem.saved - wAmount} showCoin={false} />
              </b>
            </div>
            {etaNow && etaAfter && (
              <div className="row row--between">
                <span>Срок до цели</span>
                <b>
                  {etaNow.periods} → {etaAfter.periods} {weeksWord(etaAfter.periods)}
                </b>
              </div>
            )}
            <p className="muted">Это не ошибка – иногда деньги нужны сейчас. Просто цель станет дальше</p>
          </div>
        )}
      </Confirm>
    </div>
  );
}

/* ═══════════════════ Конструктор своей цели ═══════════════════ */

/**
 * Ребёнок выбирает цель из подсказок или пишет свою, а стоимость – кнопкой
 * или своим числом в разумных рамках. Сразу видно, сколько недель
 * понадобится при обычном темпе: так тренируется оценка реалистичности цели.
 */
function GoalBuilder({
  pace,
  onCreate,
}: {
  /** Сколько сейчас уходит в копилку за неделю. 0 – пополнений ещё не было. */
  pace: number;
  onCreate: (title: string, price: number, icon: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [priceText, setPriceText] = useState('');

  const price = priceText === '' ? NaN : Number(priceText);
  const priceOk =
    Number.isInteger(price) && price >= CUSTOM_GOAL_MIN_PRICE && price <= CUSTOM_GOAL_MAX_PRICE;
  const titleOk = title.trim().length > 0;
  const suggestion = CUSTOM_GOAL_TITLES.find((t) => t.title === title.trim());
  // Если ребёнок уже откладывает – считаем по его темпу. Если ещё нет –
  // предлагаем посильную сумму, чтобы сразу было видно, за сколько дойдёт.
  const rate = pace > 0 ? pace : suggestedPace(price || 0, INCOME_REGULAR);
  const periods = priceOk ? Math.ceil(price / rate) : null;

  return (
    <div className="stack">
      <div>
        <span className="label">На что копим</span>
        <input
          className="field"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, CUSTOM_GOAL_TITLE_MAX))}
          placeholder="Например, велосипед"
          maxLength={CUSTOM_GOAL_TITLE_MAX}
          aria-label="Название цели"
        />
        <div className="chiprow" style={{ marginTop: 10 }}>
          {CUSTOM_GOAL_TITLES.map((t) => (
            <button
              key={t.title}
              className={`chip ${t.title === title ? 'is-on' : ''}`}
              aria-pressed={t.title === title}
              onClick={() => setTitle(t.title)}
            >
              {t.title}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="label">Сколько стоит</span>
        <input
          className="field"
          type="number"
          inputMode="numeric"
          min={CUSTOM_GOAL_MIN_PRICE}
          max={CUSTOM_GOAL_MAX_PRICE}
          step={10}
          value={priceText}
          onChange={(e) => setPriceText(e.target.value)}
          placeholder={`От ${CUSTOM_GOAL_MIN_PRICE} до ${CUSTOM_GOAL_MAX_PRICE} Φ`}
          aria-label="Стоимость цели"
        />
        <div className="chiprow" style={{ marginTop: 10 }}>
          {CUSTOM_GOAL_PRICES.map((v) => (
            <button
              key={v}
              className={`chip ${price === v ? 'is-on' : ''}`}
              aria-pressed={price === v}
              onClick={() => setPriceText(String(v))}
            >
              {v} Φ
            </button>
          ))}
        </div>
        {priceText !== '' && !priceOk && (
          <p className="muted" style={{ marginTop: 8, color: 'var(--red)' }}>
            Стоимость – целое число от {CUSTOM_GOAL_MIN_PRICE} до {CUSTOM_GOAL_MAX_PRICE} Φ.
          </p>
        )}
      </div>

      {periods !== null && (
        <div className="notice" style={{ background: '#e6f2fb', color: '#23566f' }}>
          <Icon name="calendar" size={18} />
          <span>
            Если откладывать по {money(rate)} за неделю, накопишь примерно за{' '}
            <b>{periods}</b> {weeksAfter(periods)}
            {periods > 20 && '. Это долго – может, сначала выбрать цель поменьше?'}
          </span>
        </div>
      )}

      <button
        className="btn"
        disabled={!titleOk || !priceOk}
        onClick={() => onCreate(title.trim(), price, suggestion?.icon ?? 'target')}
      >
        Создать цель
      </button>
    </div>
  );
}
