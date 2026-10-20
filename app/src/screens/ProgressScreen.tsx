/**
 * Прогресс: развитие питомца, итоги последней недели, история и задания.
 *
 * Никакой банковской аналитики: только то, что ребёнок может объяснить словами.
 */

import { Fragment } from 'react';

import { Icon } from '../components/Icon';
import { PetPortrait } from '../components/PetView';
import { Money, Thumb, TopBar } from '../components/ui';
import { species } from '../content/pets';
import { quest as questById } from '../content/quests';
import { DIRECTION_TITLES, money } from '../engine/economy';
import { growthToNextStage, pointsWord, stageProgress } from '../engine/pet';
import { GRADE_TITLES } from '../engine/quests';
import { useStore } from '../state/store';
import type { Nav } from '../App';
import type { Stage } from '../engine/types';

export function ProgressScreen({ nav }: { nav: Nav }) {
  const { profile, activeGoals } = useStore();
  if (!profile) return null;

  const s = species(profile.pet.species);
  const last = profile.history[profile.history.length - 1] ?? null;
  const toNext = growthToNextStage(profile.pet.growth);


  const doneQuests = [...new Set(profile.questResults.map((r) => r.questId))];

  return (
    <div className="screen">
      <TopBar title="Прогресс" subtitle={`Неделя ${profile.period.index}`} onBack={nav.onBack} />

      {/* ── Развитие питомца ── */}
      <section className="card card--hero">
        <div className="card__title">
          <Icon name="trophy" size={20} style={{ color: 'var(--gold-dark)' }} />
          Как растёт {profile.pet.name}
        </div>
        <div className="stages">
          {([1, 2, 3] as Stage[]).map((st) => (
            <div key={st} className={`stagecell ${profile.pet.stage >= st ? 'is-on' : ''}`}>
              <PetPortrait speciesId={profile.pet.species} color={profile.pet.color} stage={st} size={64} />
              <b>Стадия {st}</b>
              <span className="muted">{s.stageNames[st - 1]}</span>
              {profile.pet.stage >= st ? (
                <span className="badge badge--needs">
                  <Icon name="check" size={15} />
                  открыта
                </span>
              ) : (
                <span className="badge">
                  <Icon name="lock" size={15} />
                  закрыта
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="bar" style={{ marginTop: 12 }}>
          <div className="bar__fill" style={{ width: `${stageProgress(profile.pet.growth) * 100}%` }} />
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          Очков развития: <b>{profile.pet.growth}</b>
          {toNext
            ? ` · до следующей стадии ещё ${toNext.need} ${pointsWord(toNext.need)}`
            : ' · достигнута последняя стадия'}
        </p>
        <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
          Очки начисляются за закрытые обязательные расходы, совпадение факта с планом,
          пополнение копилки и выполненные задания
        </p>
      </section>

      {/* ── Итоги последней недели ── */}
      {last ? (
        <section className="card card--hero">
          <div className="card__title">
            <Icon name="calendar" size={20} />
            Итоги недели {last.period}
          </div>
          <p style={{ marginBottom: 10 }}>{last.verdict}</p>

          <div className="stack--tight stack">
            {last.growthReasons.map((r, i) => (
              <div key={i} className="reasonrow">
                <Icon
                  name={r.ok ? 'check' : 'info'}
                  size={18}
                  style={{ color: r.ok ? 'var(--green)' : 'var(--ink-mute)' }}
                />
                <span>{r.text}</span>
                <b className={r.ok ? 'reasonrow__pts is-on' : 'reasonrow__pts'}>+{r.points}</b>
              </div>
            ))}
          </div>

          <hr className="divider" style={{ margin: '12px 0' }} />

          {/* План и факт – таблицей: три колонки выравниваются по краю и читаются
              сразу, а не расползаются строкой «план … · факт …» */}
          <div className="planfact">
            <span />
            <span className="planfact__head">План</span>
            <span className="planfact__head">Факт</span>
            {(['needs', 'wants', 'savings'] as const).map((k) => (
              <Fragment key={k}>
                <span className="planfact__name">{DIRECTION_TITLES[k]}</span>
                <span className="planfact__num muted">
                  <Money value={last.plan[k]} showCoin={false} />
                </span>
                <b className="planfact__num">
                  <Money value={last.fact[k]} showCoin={false} />
                </b>
              </Fragment>
            ))}
          </div>

          {last.stageAfter > last.stageBefore && (
            <div className="notice notice--good" style={{ marginTop: 12 }}>
              <Icon name="star" size={20} />
              <span>
                Питомец перешёл на стадию {last.stageAfter}: {s.stageNames[last.stageAfter - 1]}
              </span>
            </div>
          )}

          <div className="nextstep" style={{ marginTop: 12 }}>
            <Icon name="play" size={16} />
            <span>
              <b>Что дальше: </b>
              {last.nextStep}
            </span>
          </div>
        </section>
      ) : (
        <section className="card card--soft">
          <p>
            Первая неделя ещё идёт. Когда ты её завершишь, здесь появится сравнение плана
            с фактом и объяснение, почему питомец изменился
          </p>
        </section>
      )}

      {/* ── Цели ── */}
      {(activeGoals.length > 0 || profile.achievedGoals.length > 0) && (
        <section className="card">
          <div className="card__title">
            <Icon name="target" size={20} style={{ color: 'var(--purple)' }} />
            Мои цели
          </div>
          <div className="stack--tight stack" style={{ marginTop: 6 }}>
            {activeGoals.map(({ goal, saved }) => (
              <div key={goal.id}>
                <div className="row" style={{ gap: 12 }}>
                  <Thumb icon={goal.icon} tone="gold" />
                  <span className="linkrow__text">
                    <b>{goal.title}</b>
                    <span className="muted">
                      {money(saved)} из {money(goal.price)}
                    </span>
                  </span>
                </div>
                <div className="bar bar--thin" style={{ marginTop: 8 }}>
                  <div
                    className="bar__fill"
                    style={{ width: `${Math.min(100, (saved / goal.price) * 100)}%`, background: 'var(--green)' }}
                  />
                </div>
              </div>
            ))}
            {profile.achievedGoals.map((a) => {
              const g = profile.goals.find((x) => x.id === a.goalId);
              return g ? (
                <div key={`${a.goalId}-${a.at}`} className="row" style={{ gap: 12 }}>
                  <Thumb icon={g.icon} tone="green" />
                  <span className="linkrow__text">
                    <b>{g.title}</b>
                    <span className="muted">Мечта исполнена на неделе {a.period}</span>
                  </span>
                  <Icon name="trophy" size={20} style={{ color: 'var(--gold-dark)' }} />
                </div>
              ) : null;
            })}
          </div>
        </section>
      )}

      {/* ── Выполненные задания ── */}
      <section className="card">
        <div className="card__title">
          <Icon name="quests" size={20} />
          Завершённые задания
        </div>
        {doneQuests.length === 0 ? (
          <p className="muted">Пока ни одного. Начни с задания дня на главном экране</p>
        ) : (
          <div className="stack--tight stack" style={{ marginTop: 6 }}>
            {doneQuests.map((id) => {
              const results = profile.questResults.filter((r) => r.questId === id);
              const best = results.some((r) => r.grade === 'good')
                ? 'good'
                : results.some((r) => r.grade === 'partial')
                  ? 'partial'
                  : 'weak';
              return (
                <div key={id} className="resultrow">
                  <span>{questById(id).title}</span>
                  <span className={`badge ${best === 'good' ? 'badge--needs' : best === 'partial' ? 'badge--savings' : 'badge--warn'}`}>
                    {GRADE_TITLES[best as 'good']}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── История недель ── */}
      {profile.history.length > 1 && (
        <section className="card">
          <div className="card__title">
            <Icon name="calendar" size={20} />
            История недель
          </div>
          <div className="stack--tight stack" style={{ marginTop: 6 }}>
            {[...profile.history].reverse().map((h) => (
              <div key={h.period} className="resultrow resultrow--short">
                <span>
                  Неделя {h.period} · заданий {h.questsDone}
                </span>
                <span className="badge badge--gold">
                  +{h.growthGained} {pointsWord(h.growthGained)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <button className="btn btn--secondary" onClick={() => nav.go({ name: 'history' })}>
        <Icon name="history" size={20} />
        История финкоинов
      </button>

      <button className="btn btn--secondary" onClick={() => nav.go({ name: 'glossary' })}>
        <Icon name="glossary" size={20} />
        Финсловарь
      </button>
    </div>
  );
}
