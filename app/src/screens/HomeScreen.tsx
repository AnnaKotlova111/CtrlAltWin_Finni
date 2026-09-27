/**
 * Главный экран.
 *
 * Отвечает сразу на три вопроса: как себя чувствует питомец,
 * что происходит с финкоинами и что сделать прямо сейчас.
 */

import { useState } from 'react';

import { Icon } from '../components/Icon';
import { PetView } from '../components/PetView';
import { Coin, Confirm, Money, Sheet, StatRing, Thumb } from '../components/ui';
import { eventForPeriod } from '../content/events';
import { species } from '../content/pets';
import { DEMO_PERIODS } from '../engine/constants';
import { moodLabel, moodReason, pointsWord, stageProgress, growthToNextStage } from '../engine/pet';
import { nextGreeting } from '../state/greeting';
import { useStore } from '../state/store';
import type { Nav } from '../App';

export function HomeScreen({ nav }: { nav: Nav }) {
  const { profile, dispatch, activeGoals, totalSavings, dailyAvailable, dailyQuest, dailyQuestDone } =
    useStore();
  const [howTo, setHowTo] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  // Фраза выбирается один раз при заходе на экран – и меняется при следующем.
  const [greeting] = useState(() => (profile ? nextGreeting(profile.pet.species) : ''));

  if (!profile) return null;

  const s = species(profile.pet.species);
  const mood = moodLabel(profile.stats);
  const event = profile.period.eventId ? eventForPeriod(profile.period.index) : null;
  const eventPending = event && !profile.period.eventResolved;

  const toNext = growthToNextStage(profile.pet.growth);

  return (
    <div className="screen screen--flush">
      <header className="topbar topbar--over">
        <span className="topbar__title">
          Привет, {profile.playerName}!
          <span className="topbar__sub">
            Период {profile.period.index}
            {/* Сценарий рассчитан на пять периодов. Дальше игра продолжается,
                но «Период 6 из 5» читалось бы как ошибка. */}
            {profile.settings.demoMode &&
              (profile.period.index <= DEMO_PERIODS
                ? ` из ${DEMO_PERIODS} · демо-режим`
                : ' · демо-режим')}
          </span>
        </span>
        <button className="iconbtn" onClick={() => setHowTo(true)} aria-label="Как играть">
          <Icon name="info" size={22} />
        </button>
        <button className="iconbtn" onClick={() => nav.go({ name: 'settings' })} aria-label="Настройки">
          <Icon name="settings" size={22} />
        </button>
      </header>

      <div className="home">
        {/* ── Питомец в комнате ── */}
        <section className="home__pet">
          <PetView
            speciesId={profile.pet.species}
            color={profile.pet.color}
            stage={profile.pet.stage}
            animated={profile.settings.animations}
            hud={
              <>
                <span className="hudbalance">
                  <span className="sr-only">Баланс: </span>
                  <Coin size={22} />
                  <Money value={profile.balance} showCoin={false} />
                </span>
                {dailyAvailable && (
                  <button className="btn btn--sm" onClick={() => dispatch({ type: 'daily/claim' })}>
                    <Icon name="gift" size={18} />
                    Бонус
                  </button>
                )}
              </>
            }
            speech={
              <div className="bubble">
                <b>{profile.pet.name}</b>
                <span>{greeting}</span>
              </div>
            }
          />
        </section>

        <div className="home__body">
          {/* ── Состояние ── */}
          {/* Настроение показывает само кольцо: значок внутри меняется
              вместе с состоянием питомца. */}
          <div className="statrings">
            <StatRing
              icon={mood.icon as 'mood-good'}
              title="Настроение"
              value={profile.stats.mood}
              color="var(--pink)"
            />
            <StatRing icon="bowl" title="Сытость" value={profile.stats.fullness} color="var(--green)" />
            <StatRing icon="blanket" title="Комфорт" value={profile.stats.comfort} color="var(--blue)" />
          </div>

          {/* Причина настроения стоит сразу под кольцами – она их и объясняет.
              Все причины упираются в покупки, поэтому строка ведёт в лавку. */}
          <button className="moodlink" onClick={() => nav.go({ name: 'shop' })}>
            <span>{moodReason(profile.stats)}</span>
            <Icon name="chevron-right" size={26} />
          </button>

          {/* Развитие питомца: строка со стадией и тонкая полоса под ней. */}
          <section className="card card--tight stagecard">
            <div className="stagecard__head">
              <Icon name="trophy" size={18} />
              <b>
                Стадия {profile.pet.stage} · {s.stageNames[profile.pet.stage - 1]}
              </b>
              <span className="muted">
                {toNext ? `ещё ${toNext.need} ${pointsWord(toNext.need)}` : 'последняя стадия'}
              </span>
            </div>
            <div className="bar bar--thin">
              <div className="bar__fill" style={{ width: `${stageProgress(profile.pet.growth) * 100}%` }} />
            </div>
          </section>

          {/* ── Задание дня ──
              Одно задание на сутки. Решённое задание не подменяется следующим:
              вместо этого экран честно говорит, что на сегодня всё. */}
          {dailyQuest && (
            <section className="card card--hero">
              <div className="row row--between">
                <span className={dailyQuestDone ? 'badge badge--needs' : 'badge'}>
                  <Icon name={dailyQuestDone ? 'check' : 'quests'} size={16} />
                  {dailyQuestDone ? 'Задание дня выполнено' : 'Задание дня'}
                </span>
                {!dailyQuestDone && (
                  <span className="badge badge--gold">
                    <Coin size={13} />+{dailyQuest.reward}
                  </span>
                )}
              </div>
              <h3 style={{ marginTop: 8 }}>{dailyQuest.title}</h3>
              <p className="muted" style={{ marginTop: 4 }}>
                {dailyQuestDone
                  ? 'Новое задание появится завтра. А пока можно пройти любое другое'
                  : dailyQuest.situation}
              </p>
              <button
                className={dailyQuestDone ? 'btn btn--secondary' : 'btn'}
                style={{ marginTop: 12 }}
                onClick={() =>
                  nav.go(dailyQuestDone ? { name: 'quests' } : { name: 'quest', id: dailyQuest.id })
                }
              >
                {dailyQuestDone ? 'Все задания' : 'Решить'}
              </button>
            </section>
          )}

          {/* ── Деньги ── */}
          <section className="card card--hero">
            <button className="linkrow" onClick={() => nav.go({ name: 'history' })}>
              <Thumb icon="history" />
              <span className="linkrow__text">
                <b>Мои финкоины</b>
                <span className="muted">Откуда пришли и куда ушли</span>
              </span>
            </button>
            <hr className="divider" style={{ margin: '12px 0' }} />
            <button className="linkrow" onClick={() => nav.go({ name: 'savings' })}>
              <Thumb icon="piggy" tone="green" />
              <span className="linkrow__text">
                <b>Моя копилка</b>
                <span className="muted">
                  {activeGoals.length === 0
                    ? 'Цель ещё не выбрана'
                    : activeGoals.length === 1
                      ? `Цель: ${activeGoals[0].goal.title}`
                      : `Целей: ${activeGoals.length}`}
                </span>
              </span>
              <span className="linkrow__right">
                <Money value={totalSavings} showCoin={false} />
              </span>
            </button>
            {/* У каждой цели – своя полоска прогресса. */}
            {activeGoals.map(({ goal, saved }) => (
              <div key={goal.id} style={{ marginTop: 10 }}>
                <div className="row row--between" style={{ fontSize: 'var(--fs-sm)' }}>
                  <span>{goal.title}</span>
                  <span className="muted">
                    <Money value={saved} showCoin={false} /> из <Money value={goal.price} showCoin={false} />
                  </span>
                </div>
                <div className="bar bar--thin" style={{ marginTop: 4 }}>
                  <div
                    className="bar__fill"
                    style={{ width: `${Math.min(100, (saved / goal.price) * 100)}%`, background: 'var(--green)' }}
                  />
                </div>
              </div>
            ))}
          </section>

          {/* ── Непредвиденное событие периода ── */}
          {eventPending && (
            <section className="card card--hero eventcard">
              <span className="badge badge--gold">
                <Icon name="calendar" size={16} />
                Событие периода
              </span>
              <h3 style={{ marginTop: 8 }}>{event.title}</h3>
              <p className="muted" style={{ marginTop: 4 }}>
                {event.text}
              </p>
              {event.kind === 'income' ? (
                <button className="btn" style={{ marginTop: 12 }} onClick={() => dispatch({ type: 'event/resolve', optionId: 'ok' })}>
                  Принять <Money value={event.amount} showCoin={false} />
                </button>
              ) : (
                <div className="stack--tight stack" style={{ marginTop: 12 }}>
                  {event.options!.map((o) => (
                    <button
                      key={o.id}
                      className="optionrow"
                      onClick={() => dispatch({ type: 'event/resolve', optionId: o.id })}
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
            </section>
          )}

          {/* ── Быстрые переходы ── */}
          <div className="grid-2">
            <button className="tile" onClick={() => nav.go({ name: 'shop' })}>
              <Thumb icon="shop" tone="gold" />
              <b>Покупки</b>
              <span className="muted">Обязательное и желаемое</span>
            </button>
            <button className="tile" onClick={() => nav.go({ name: 'quests' })}>
              <Thumb icon="quests" />
              <b>Задания</b>
              <span className="muted">{profile.questResults.length} пройдено</span>
            </button>
            <button className="tile" onClick={() => nav.go({ name: 'progress' })}>
              <Thumb icon="progress" tone="green" />
              <b>Прогресс</b>
              <span className="muted">История и итоги</span>
            </button>
            <button className="tile" onClick={() => nav.go({ name: 'glossary' })}>
              <Thumb icon="glossary" />
              <b>Финсловарь</b>
              <span className="muted">Что значит слово</span>
            </button>
          </div>

          {/* ── Завершение периода ── */}
          <section className="card card--soft">
            <div className="card__title">
              <Icon name="calendar" size={20} />
              Подведём итоги!
            </div>
            <p className="muted">
              Посмотрим, как прошёл период и чему научился {profile.pet.name}
              {profile.settings.demoMode && '. В демо-режиме – сразу, без ожидания'}
            </p>
            <button
              className="btn"
              style={{ marginTop: 12 }}
              onClick={() => setConfirmClose(true)}
              disabled={eventPending ?? false}
            >
              Завершить период {profile.period.index}
            </button>
            {/* В демонстрационном режиме сутки тоже нужно уметь перемотать:
                иначе бонус за вход показать не получится. */}
            {profile.settings.demoMode && (
              <>
                <button
                  className="btn btn--secondary"
                  style={{ marginTop: 10 }}
                  onClick={() => dispatch({ type: 'demo/nextDay' })}
                  disabled={dailyAvailable}
                >
                  <Icon name="calendar" size={20} />
                  Следующий день
                </button>
                {/* Показать все три стадии питомца, не набирая очки развития. */}
                <button
                  className="btn btn--secondary"
                  style={{ marginTop: 10 }}
                  onClick={() => dispatch({ type: 'demo/nextStage' })}
                >
                  <Icon name="trophy" size={20} />
                  Следующая стадия питомца
                </button>
              </>
            )}
            {eventPending && (
              <p className="muted" style={{ marginTop: 8 }}>
                Сначала реши, что делать с событием периода
              </p>
            )}
          </section>

          <button className="adultlink" onClick={() => nav.go({ name: 'adult' })}>
            <Icon name="adult" size={20} />
            Раздел для взрослого
          </button>
        </div>
      </div>

      <Confirm
        open={confirmClose}
        title="Завершить период?"
        confirmLabel="Завершить"
        onCancel={() => setConfirmClose(false)}
        onConfirm={() => {
          setConfirmClose(false);
          dispatch({ type: 'period/close' });
          nav.go({ name: 'progress' });
        }}
      >
        Период закроется, и начнётся следующий. Прогресс сохранится – он никогда не обнуляется
      </Confirm>

      <Sheet open={howTo} onClose={() => setHowTo(false)} title="Как играть">
        <div className="stack">
          <ol className="howto">
            <li>
              <b>Составь план.</b> Реши, сколько финкоинов уйдёт на обязательное, желаемое
              и в копилку
            </li>
            <li>
              <b>Трать по плану.</b> Сначала еда и уход – от них зависит сытость питомца
            </li>
            <li>
              <b>Откладывай.</b> Даже маленькая сумма приближает цель
            </li>
            <li>
              <b>Выполняй задания.</b> За них начисляют финкоины и объясняют, что произошло
            </li>
            <li>
              <b>Заверши период.</b> Сравним план с фактом – питомец подрастёт
            </li>
          </ol>
          <p className="muted">
            Ошибка не страшна: прогресс не обнуляется, а приложение подскажет, как поправить
            ситуацию
          </p>
          <button className="btn" onClick={() => setHowTo(false)}>
            Понятно
          </button>
        </div>
      </Sheet>
    </div>
  );
}
