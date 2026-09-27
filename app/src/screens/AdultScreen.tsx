/**
 * Раздел для взрослого.
 *
 * Отделён простым барьером – арифметическим примером. Внутри: зачем нужна
 * игра, какие темы уже пройдены, общий прогресс, начисление бонусов
 * и управление локальным профилем.
 *
 * Правило раздела: никаких негативных оценок ребёнка. Показываем, что
 * освоено, а не что «сделано неправильно».
 */

import { useMemo, useState } from 'react';

import { Icon } from '../components/Icon';
import { Confirm, Money, TopBar } from '../components/ui';
import { GLOSSARY } from '../content/glossary';
import { QUESTS, THEMES, THEME_TITLES } from '../content/quests';
import { PARENT_BONUS_MAX } from '../engine/constants';
import { money } from '../engine/economy';
import { useStore } from '../state/store';
import type { Nav } from '../App';
import type { Profile } from '../engine/types';

/** Простой барьер: пример на умножение. Взрослому – мгновенно, ребёнку 7–11 – нет. */
function makeTask() {
  const a = 6 + Math.floor(Math.random() * 7); // 6..12
  const b = 7 + Math.floor(Math.random() * 6); // 7..12
  return { a, b, answer: a * b };
}

/** За что взрослый может начислить финкоины – дела вне игры. */
const BONUS_REASONS = [
  'Помощь по дому',
  'Уборка в комнате',
  'Успехи в учёбе',
  'Прочитанная книга',
  'Спорт и тренировки',
  'Помощь с покупками',
  'Разговор о деньгах',
  'Забота о домашнем питомце',
  'Доброе дело',
  'Своя цель достигнута',
];

/** Особый пункт: причину вводит сам взрослый. */
const OWN_REASON = 'Своя причина';

const BONUS_PRESETS = [10, 20, 30, 50, 100];

export function AdultScreen({ nav }: { nav: Nav }) {
  const { profile, dispatch } = useStore();
  const [task, setTask] = useState(makeTask);
  const [input, setInput] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState(false);
  const [askReset, setAskReset] = useState(false);
  const [askDelete, setAskDelete] = useState(false);

  /** Темы считаются пройденными, если в теме выполнено хотя бы одно задание. */
  const themeProgress = useMemo(() => {
    if (!profile) return [];
    const done = new Set(profile.questResults.map((r) => r.questId));
    return THEMES.map((t) => {
      const all = QUESTS.filter((q) => q.theme === t);
      return { theme: t, done: all.filter((q) => done.has(q.id)).length, total: all.length };
    });
  }, [profile]);

  if (!profile) return null;

  if (!unlocked) {
    return (
      <div className="screen">
        <TopBar title="Раздел для взрослого" onBack={nav.onBack} />
        <section className="card card--hero stack center">
          <Icon name="adult" size={46} style={{ margin: '0 auto' }} />
          <h3>Этот раздел – для взрослого</h3>
          <p className="muted">Решите пример, чтобы продолжить</p>
          <div className="mathtask">
            {task.a} × {task.b} = ?
          </div>
          <input
            className="field"
            type="number"
            inputMode="numeric"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(false);
            }}
            placeholder="Ответ"
            aria-label="Ответ на пример"
          />
          {error && (
            <div className="notice notice--warn">
              <Icon name="warning" size={20} />
              <span>Не сходится. Попробуйте ещё раз</span>
            </div>
          )}
          <button
            className="btn"
            onClick={() => {
              if (Number(input) === task.answer) {
                setUnlocked(true);
              } else {
                setError(true);
                setTask(makeTask());
                setInput('');
              }
            }}
          >
            Войти
          </button>
        </section>
      </div>
    );
  }

  const spentNeeds = profile.purchaseLog.filter((p) => p.kind === 'needs').reduce((s, p) => s + p.price, 0);
  const spentWants = profile.purchaseLog.filter((p) => p.kind === 'wants').reduce((s, p) => s + p.price, 0);
  const savedTotal = profile.savingsLog.filter((s) => s.amount > 0).reduce((s, x) => s + x.amount, 0);

  return (
    <div className="screen">
      <TopBar title="Раздел для взрослого" onBack={nav.onBack} />

      {/* ── Зачем это приложение ── */}
      <section className="card card--hero">
        <div className="card__title">
          <Icon name="info" size={20} style={{ color: 'var(--blue)' }} />
          Зачем эта игра
        </div>
        <p>
          Ребёнок получает ограниченную сумму игровых финкоинов, планирует её на обязательное,
          желаемое и накопления, видит последствия решений и наблюдает, как растёт питомец
        </p>
        <ul className="bullets">
          <li>Понимать, зачем нужен личный бюджет и что расходы не превышают доходы</li>
          <li>Различать обязательные и необязательные расходы</li>
          <li>Планировать покупки при ограниченном бюджете</li>
          <li>Ставить краткосрочную цель и регулярно откладывать</li>
          <li>Оценивать свои решения и объяснять, к чему они привели</li>
        </ul>
        <p className="muted" style={{ marginTop: 10 }}>
          Образовательная основа – Единая рамка компетенций в области финансовой грамотности
          и финансовой культуры, раздел для начального общего образования (7–11 лет)
        </p>
      </section>

      {/* ── Что освоено ── */}
      <section className="card">
        <div className="card__title">
          <Icon name="progress" size={20} style={{ color: 'var(--green)' }} />
          Пройденные темы
        </div>
        <div className="stack--tight stack" style={{ marginTop: 6 }}>
          {themeProgress.map((t) => (
            <div key={t.theme}>
              <div className="row row--between">
                <span>{THEME_TITLES[t.theme]}</span>
                <b>
                  {t.done} из {t.total}
                </b>
              </div>
              <div className="bar bar--thin" style={{ marginTop: 5 }}>
                <div className="bar__fill" style={{ width: `${(t.done / t.total) * 100}%`, background: 'var(--green)' }} />
              </div>
            </div>
          ))}
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          Финсловарь: прочитано {profile.glossarySeen.length} из {GLOSSARY.length} терминов
        </p>
      </section>

      {/* ── Общий прогресс ── */}
      <section className="card">
        <div className="card__title">
          <Icon name="trophy" size={20} style={{ color: 'var(--gold-dark)' }} />
          Общий прогресс
        </div>
        <div className="stack--tight stack" style={{ marginTop: 6 }}>
          <div className="row row--between">
            <span className="muted">Игровых периодов пройдено</span>
            <b>{profile.history.length}</b>
          </div>
          <div className="row row--between">
            <span className="muted">Стадия развития питомца</span>
            <b>
              {profile.pet.stage} из 3
            </b>
          </div>
          <div className="row row--between">
            <span className="muted">Направлено в накопления</span>
            <b>
              <Money value={savedTotal} showCoin={false} />
            </b>
          </div>
          <div className="row row--between">
            <span className="muted">Обязательные расходы</span>
            <b>
              <Money value={spentNeeds} showCoin={false} />
            </b>
          </div>
          <div className="row row--between">
            <span className="muted">Необязательные расходы</span>
            <b>
              <Money value={spentWants} showCoin={false} />
            </b>
          </div>
        </div>
      </section>

      {/* ── Цели ребёнка ── */}
      <ChildGoals profile={profile} />

      {/* ── Начисление бонусов ── */}
      <section className="card">
        <div className="card__title">
          <Icon name="gift" size={20} style={{ color: 'var(--pink)' }} />
          Начислить финкоины
        </div>
        <p className="muted">
          Можно поощрить ребёнка за дело вне игры. Начисление появится в истории с указанием
          причины – баланс не меняется без объяснения
        </p>
        <ParentBonus
          onGive={(amount, reason) => dispatch({ type: 'parent/bonus', amount, reason })}
        />
        {profile.parentBonuses.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <span className="label">Последние начисления</span>
            {[...profile.parentBonuses]
              .reverse()
              .slice(0, 4)
              .map((b) => (
                <div key={b.id} className="row row--between historyrow">
                  <span>{b.source.replace('От взрослого: ', '')}</span>
                  <b>+{money(b.amount)}</b>
                </div>
              ))}
            <p className="muted" style={{ marginTop: 6 }}>
              Всего от взрослого: {money(profile.parentBonuses.reduce((s, b) => s + b.amount, 0))}
            </p>
          </div>
        )}
      </section>

      {/* ── Данные и приватность ── */}
      <section className="card">
        <div className="card__title">
          <Icon name="shield" size={20} style={{ color: 'var(--purple)' }} />
          Данные ребёнка
        </div>
        <ul className="bullets">
          <li>Регистрация не нужна, аккаунт не создаётся</li>
          <li>Всё хранится только на этом устройстве</li>
          <li>Настоящее имя, телефон, почта и платёжные данные не запрашиваются</li>
          <li>Нет рекламы, платных подписок и внутриигровых покупок</li>
          <li>Финкоины – игровые: они не продаются и не меняются на деньги</li>
        </ul>
      </section>

      <section className="card">
        <div className="card__title">
          <Icon name="refresh" size={20} />
          Управление профилем
        </div>
        <div className="stack--tight stack" style={{ marginTop: 6 }}>
          <label className="switchrow">
            <span>
              <b>Демонстрационный режим</b>
              <span className="muted">Все задания открыты, периоды переключаются без ожидания</span>
            </span>
            <input
              type="checkbox"
              checked={profile.settings.demoMode}
              onChange={(e) => dispatch({ type: 'settings', patch: { demoMode: e.target.checked } })}
            />
          </label>
          <button className="btn btn--secondary" onClick={() => setAskReset(true)}>
            Сбросить прогресс
          </button>
          <button className="btn btn--danger" onClick={() => setAskDelete(true)}>
            <Icon name="trash" size={18} />
            Удалить профиль
          </button>
        </div>
      </section>

      <Confirm
        open={askReset}
        title="Сбросить прогресс?"
        confirmLabel="Сбросить"
        onCancel={() => setAskReset(false)}
        onConfirm={() => {
          setAskReset(false);
          dispatch({ type: 'profile/reset' });
          nav.reset({ name: 'home' });
        }}
      >
        Баланс, копилка, покупки, задания и стадия развития вернутся к исходному состоянию.
        Имя и питомец сохранятся. Это действие нельзя отменить
      </Confirm>

      <Confirm
        open={askDelete}
        title="Удалить профиль?"
        confirmLabel="Удалить"
        danger
        onCancel={() => setAskDelete(false)}
        onConfirm={() => {
          setAskDelete(false);
          dispatch({ type: 'profile/delete' });
        }}
      >
        Локальный профиль будет удалён с устройства полностью, включая имя и питомца.
        Восстановить его будет невозможно
      </Confirm>
    </div>
  );
}

/* ═══════════════ Начисление финкоинов от взрослого ═══════════════ */

/**
 * Два шага: за что и сколько. Сумму можно выбрать кнопкой или ввести
 * свою – от 1 до PARENT_BONUS_MAX, чтобы начисление не обесценило игру.
 */
function ParentBonus({ onGive }: { onGive: (amount: number, reason: string) => void }) {
  const [reason, setReason] = useState(BONUS_REASONS[0]);
  const [ownReason, setOwnReason] = useState('');
  const [amount, setAmount] = useState<number>(20);
  const [amountText, setAmountText] = useState('20');

  const isOwn = reason === OWN_REASON;
  const finalReason = isOwn ? ownReason.trim() : reason;
  const amountOk = Number.isInteger(amount) && amount >= 1 && amount <= PARENT_BONUS_MAX;
  const canGive = amountOk && finalReason.length > 0;

  const pickAmount = (v: number) => {
    setAmount(v);
    setAmountText(String(v));
  };

  return (
    <div className="stack" style={{ marginTop: 12 }}>
      <div>
        <span className="label">За что</span>
        <div className="chipgrid">
          {[...BONUS_REASONS, OWN_REASON].map((r) => (
            <button
              key={r}
              className={`chip ${r === reason ? 'is-on' : ''}`}
              aria-pressed={r === reason}
              onClick={() => setReason(r)}
            >
              {r}
            </button>
          ))}
        </div>
        {isOwn && (
          <input
            className="field"
            style={{ marginTop: 10 }}
            value={ownReason}
            onChange={(e) => setOwnReason(e.target.value.slice(0, 40))}
            placeholder="Например, помощь бабушке"
            maxLength={40}
            aria-label="Своя причина начисления"
            autoFocus
          />
        )}
      </div>

      <div>
        <span className="label">Сколько финкоинов</span>
        <div className="chipgrid chipgrid--amounts">
          {BONUS_PRESETS.map((v) => (
            <button
              key={v}
              className={`chip ${amount === v && amountText === String(v) ? 'is-on' : ''}`}
              aria-pressed={amount === v}
              onClick={() => pickAmount(v)}
            >
              {v} Φ
            </button>
          ))}
        </div>
        <input
          className="field"
          style={{ marginTop: 10 }}
          type="number"
          inputMode="numeric"
          min={1}
          max={PARENT_BONUS_MAX}
          step={1}
          value={amountText}
          onChange={(e) => {
            setAmountText(e.target.value);
            setAmount(e.target.value === '' ? 0 : Number(e.target.value));
          }}
          placeholder="Своя сумма"
          aria-label="Своя сумма финкоинов"
        />
        {!amountOk && amountText !== '' && (
          <p className="muted" style={{ marginTop: 6, color: 'var(--red)' }}>
            Введите целое число от 1 до {PARENT_BONUS_MAX}.
          </p>
        )}
      </div>

      <button
        className="btn"
        disabled={!canGive}
        onClick={() => {
          onGive(amount, finalReason);
          if (isOwn) setOwnReason('');
        }}
      >
        <Icon name="gift" size={18} />
        {amountOk ? `Начислить ${money(amount)}` : 'Начислить'}
      </button>
      {isOwn && !finalReason && (
        <p className="muted center">Напишите причину – ребёнок увидит её в истории</p>
      )}
    </div>
  );
}

/* ═══════════════════════ Цели ребёнка ═══════════════════════ */

/**
 * Цели, которые ребёнок выбрал или придумал сам. Своя цель может оказаться
 * настоящей мечтой – взрослому полезно о ней знать и, возможно, обсудить.
 */
function ChildGoals({ profile }: { profile: Profile }) {
  const achieved = new Map(profile.achievedGoals.map((x) => [x.goalId, x]));
  const goals = profile.goals.filter(
    (g) =>
      g.custom ||
      profile.activeGoalIds.includes(g.id) ||
      achieved.has(g.id) ||
      (profile.savedByGoal[g.id] ?? 0) > 0
  );
  // Свои цели – первыми: они больше всего говорят о ребёнке.
  goals.sort((a, b) => Number(!!b.custom) - Number(!!a.custom));

  return (
    <section className="card">
      <div className="card__title">
        <Icon name="target" size={20} style={{ color: 'var(--purple)' }} />
        Цели ребёнка
      </div>
      {goals.length === 0 ? (
        <p className="muted">Ребёнок пока не выбрал цель накопления</p>
      ) : (
        <>
          <p className="muted">
            Цели, которые ребёнок выбрал или придумал сам. Если какая-то из них – настоящая
            мечта, её можно обсудить вместе, а может быть, и осуществить
          </p>
          <div className="stack--tight stack" style={{ marginTop: 10 }}>
            {goals.map((g) => {
              const done = achieved.get(g.id);
              const saved = done ? g.price : (profile.savedByGoal[g.id] ?? 0);
              const share = Math.min(100, Math.round((saved / g.price) * 100));
              const active = profile.activeGoalIds.includes(g.id);
              return (
                <div key={g.id} className="childgoal">
                  <div className="row row--between" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <b>{g.title}</b>
                    <span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                      {g.custom && (
                        <span className="badge badge--gold">
                          <Icon name="star" size={15} />
                          своя цель
                        </span>
                      )}
                      {active && <span className="badge">сейчас копит</span>}
                      {done && (
                        <span className="badge badge--needs">
                          <Icon name="trophy" size={15} />
                          исполнена
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="bar bar--thin" style={{ marginTop: 6 }}>
                    <div className="bar__fill" style={{ width: `${share}%`, background: 'var(--green)' }} />
                  </div>
                  <p className="muted" style={{ marginTop: 4 }}>
                    {done
                      ? `Накоплено ${money(g.price)} · мечта исполнена в периоде ${done.period}`
                      : `Накоплено ${money(saved)} из ${money(g.price)} · ${share} %`}
                    {g.custom && g.createdPeriod ? ` · придумана в периоде ${g.createdPeriod}` : ''}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
