/**
 * Прохождение задания.
 *
 * Каждый тип задания рисуется своим блоком, но результат обрабатывается
 * одинаково: оценка → последствие → объяснение → следующий шаг.
 * Объяснение показывается всегда, независимо от правильности решения.
 */

import { useMemo, useState } from 'react';

import { Icon } from '../components/Icon';
import { Coin, Money, Stepper, Thumb, TopBar } from '../components/ui';
import { quest as questById, THEME_TITLES } from '../content/quests';
import { questRemark } from '../content/remarks';
import { PetSpeech } from '../components/PetSpeech';
import { money } from '../engine/economy';
import { gradeQuest, type QuestAnswer } from '../engine/quests';
import { useStore } from '../state/store';
import type { Nav } from '../App';

const STEP = 10;

export function QuestScreen({ nav, questId }: { nav: Nav; questId: string }) {
  const { profile, dispatch } = useStore();
  const q = questById(questId);

  const isReplay = useMemo(
    () => !!profile?.questResults.some((r) => r.questId === questId),
    [profile, questId]
  );

  // Состояние для каждого типа задания.
  const [buckets, setBuckets] = useState<Record<string, number>>(() =>
    q.kind === 'allocate' ? Object.fromEntries(q.buckets.map((b) => [b.id, 0])) : {}
  );
  const [cart, setCart] = useState<string[]>([]);
  const [numberValue, setNumberValue] = useState<number | null>(null);

  if (!profile) return null;

  const remark = questRemark(q.id, profile.pet.species);

  const submit = (answer: QuestAnswer) => {
    const outcome = gradeQuest(q, answer, isReplay);
    dispatch({ type: 'quest/done', questId: q.id, outcome, isReplay });
    nav.back();
  };

  return (
    <div className="screen">
      <TopBar title={q.title} subtitle={THEME_TITLES[q.theme]} onBack={nav.onBack} />

      <section className="card card--hero">
        <div className="row" style={{ gap: 8, marginBottom: 8 }}>
          <span className="badge">
            <Icon name="quests" size={16} />
            {THEME_TITLES[q.theme]}
          </span>
          {isReplay ? (
            <span className="badge">тренировка · без награды</span>
          ) : (
            <span className="badge badge--gold">
              <Coin size={13} />
              до {q.reward}
            </span>
          )}
        </div>
        <p style={{ fontSize: 'var(--fs-lg)' }}>{q.situation}</p>
        <p className="muted" style={{ marginTop: 10 }}>
          <b>{q.task}</b>
        </p>
      </section>

      {remark && <PetSpeech line={remark.says} note={remark.note} size={60} />}

      {/* ── Распределение суммы ── */}
      {q.kind === 'allocate' && (
        <AllocateBody
          amount={q.amount}
          buckets={q.buckets}
          values={buckets}
          onChange={setBuckets}
          onSubmit={() => submit({ kind: 'allocate', values: buckets })}
        />
      )}

      {/* ── Корзина в рамках лимита ── */}
      {q.kind === 'cart' && (
        <CartBody
          limit={q.limit}
          options={q.options}
          chosen={cart}
          onToggle={(id) =>
            setCart((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
          }
          onSubmit={() => submit({ kind: 'cart', chosen: cart })}
        />
      )}

      {/* ── Числовой ответ ── */}
      {q.kind === 'number' && (
        <section className="card stack">
          <div className="chiprow">
            {q.presets.map((p) => (
              <button
                key={p}
                className={`chip chip--big ${numberValue === p ? 'is-on' : ''}`}
                onClick={() => setNumberValue(p)}
              >
                {p} {q.unit}
              </button>
            ))}
          </div>
          <label className="label" htmlFor="qnum">
            Или введи свой ответ
          </label>
          <input
            id="qnum"
            className="field"
            type="number"
            inputMode="numeric"
            value={numberValue ?? ''}
            onChange={(e) => setNumberValue(e.target.value === '' ? null : Number(e.target.value))}
            placeholder="0"
          />
          <button
            className="btn"
            disabled={numberValue === null}
            onClick={() => submit({ kind: 'number', value: numberValue ?? 0 })}
          >
            Ответить
          </button>
        </section>
      )}

      {/* ── Выбор в ситуации ── */}
      {q.kind === 'choice' && (
        <div className="stack--tight stack">
          {q.options.map((o) => (
            <button
              key={o.id}
              className="optionrow optionrow--card"
              onClick={() => submit({ kind: 'choice', optionId: o.id })}
            >
              <span className="optionrow__text">
                <b>{o.title}</b>
                {o.note && <span className="muted">{o.note}</span>}
              </span>
              <Icon name="chevron-right" size={22} />
            </button>
          ))}
        </div>
      )}

      {/* ── Сравнение предложений ── */}
      {q.kind === 'compare' && (
        <div className="stack--tight stack">
          {q.offers.map((o) => (
            <button
              key={o.id}
              className="card offercard"
              onClick={() => submit({ kind: 'compare', optionId: o.id })}
            >
              <div className="row row--between">
                <b>{o.title}</b>
                <span className="price">
                  {o.oldPrice && (
                    <s className="price__old">
                      <Money value={o.oldPrice} showCoin={false} />
                    </s>
                  )}
                  <Money value={o.price} />
                </span>
              </div>
              <p className="muted" style={{ marginTop: 6 }}>
                {o.detail}
              </p>
              {o.note && <p className="muted">{o.note}</p>}
            </button>
          ))}
        </div>
      )}

    </div>
  );
}

/* ═══════════════ Блоки под типы заданий ═══════════════ */

function AllocateBody({
  amount,
  buckets,
  values,
  onChange,
  onSubmit,
}: {
  amount: number;
  buckets: { id: string; label: string; hint: string; icon: string }[];
  values: Record<string, number>;
  onChange: (v: Record<string, number>) => void;
  onSubmit: () => void;
}) {
  const total = Object.values(values).reduce((s, v) => s + v, 0);
  const rest = amount - total;

  return (
    <div className="stack--tight stack">
      <section className="card card--soft">
        <div className="row row--between">
          <span>Не распределено</span>
          <b className={rest === 0 ? '' : 'money'}>
            <Money value={rest} showCoin={false} />
          </b>
        </div>
        <div className="bar" style={{ marginTop: 8 }}>
          <div className="bar__fill" style={{ width: `${(total / amount) * 100}%` }} />
        </div>
      </section>

      {buckets.map((b) => (
        <section key={b.id} className="card">
          <div className="row" style={{ gap: 10 }}>
            <Thumb icon={b.icon} />
            <span className="linkrow__text">
              <b>{b.label}</b>
              <span className="muted">{b.hint}</span>
            </span>
          </div>
          <div style={{ marginTop: 12 }}>
            <Stepper
              value={values[b.id] ?? 0}
              step={STEP}
              max={(values[b.id] ?? 0) + rest}
              onChange={(v) => onChange({ ...values, [b.id]: v })}
              label={b.label}
            />
          </div>
        </section>
      ))}

      <button className="btn" onClick={onSubmit} disabled={total === 0}>
        Готово
      </button>
      {rest > 0 && <p className="muted center">Осталось распределить {money(rest)}</p>}
    </div>
  );
}

function CartBody({
  limit,
  options,
  chosen,
  onToggle,
  onSubmit,
}: {
  limit: number;
  options: { id: string; title: string; price: number; essential: boolean; icon: string }[];
  chosen: string[];
  onToggle: (id: string) => void;
  onSubmit: () => void;
}) {
  const sum = options.filter((o) => chosen.includes(o.id)).reduce((s, o) => s + o.price, 0);
  const left = limit - sum;

  return (
    <div className="stack--tight stack">
      <section className="card card--soft">
        <div className="row row--between">
          <span>Осталось из {money(limit)}</span>
          <b>
            <Money value={left} showCoin={false} />
          </b>
        </div>
        <div className="bar" style={{ marginTop: 8 }}>
          <div
            className="bar__fill"
            style={{ width: `${Math.min(100, (sum / limit) * 100)}%`, background: left < 0 ? 'var(--red)' : 'var(--purple)' }}
          />
        </div>
      </section>

      {options.map((o) => {
        const picked = chosen.includes(o.id);
        const tooExpensive = !picked && o.price > left;
        return (
          <button
            key={o.id}
            className={`linkrow linkrow--card ${picked ? 'is-on' : ''}`}
            onClick={() => onToggle(o.id)}
            disabled={tooExpensive}
            aria-pressed={picked}
          >
            <Thumb icon={o.icon} tone={picked ? 'green' : 'lavender'} />
            <span className="linkrow__text">
              <b>{o.title}</b>
              <span className="muted">
                {money(o.price)}
                {tooExpensive && ' · не хватает'}
              </span>
            </span>
            <span className="checkbox" aria-hidden="true">
              {picked && <Icon name="check" size={16} />}
            </span>
          </button>
        );
      })}

      <button className="btn" onClick={onSubmit} disabled={chosen.length === 0}>
        Список готов
      </button>
    </div>
  );
}
