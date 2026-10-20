/**
 * Окно обратной связи.
 *
 * Показывается после каждого финансового действия и отвечает на вопрос
 * «что изменилось и почему», а затем предлагает следующий шаг.
 * Реплики и пояснения произносит питомец ребёнка – с его портретом.
 */

import { useState } from 'react';

import { useStore, type Celebration } from '../state/store';
import { STAT_TITLES } from '../engine/pet';
import { Icon, type IconName } from './Icon';
import { PetSpeech } from './PetSpeech';
import { PetPortrait } from './PetView';
import { Confirm, Sheet } from './ui';
import type { PetStats } from '../engine/types';

const TONE_ICON: Record<'good' | 'info' | 'warn', IconName> = {
  good: 'check',
  info: 'info',
  warn: 'warning',
};

const TONE_COLOR: Record<'good' | 'info' | 'warn', string> = {
  good: 'var(--green)',
  info: 'var(--blue)',
  warn: 'var(--red)',
};

function StatDelta({ delta }: { delta: Partial<PetStats> }) {
  const entries = Object.entries(delta) as [keyof PetStats, number][];
  if (entries.length === 0) return null;
  return (
    <div className="deltas">
      {entries.map(([key, value]) => (
        <span key={key} className={`delta ${value > 0 ? 'delta--up' : 'delta--down'}`}>
          <Icon name={value > 0 ? 'plus' : 'minus'} size={16} />
          {/* Знак пишем и словом: «Комфорт 5» читалось как значение,
              а не как прибавку. */}
          {STAT_TITLES[key]} {value > 0 ? '+' : '−'}
          {Math.abs(value)}
        </span>
      ))}
    </div>
  );
}

/**
 * Поздравление: питомец крупно, повод и настоящие числа.
 *
 * Реплику питомец говорит здесь же, в облачке под портретом, – второй
 * портрет рядом с таким большим спорил бы с ним за внимание.
 */
function Celebrate({ view, says }: { view: Celebration; says: string | null }) {
  const { profile } = useStore();
  if (!profile) return null;

  return (
    <div className={`celebrate celebrate--${view.kind}`}>
      <div className="celebrate__glow" aria-hidden="true" />

      <PetPortrait
        speciesId={profile.pet.species}
        color={profile.pet.color}
        stage={profile.pet.stage}
        size={108}
      />

      <p className="celebrate__headline">
        <Icon name={view.kind === 'goal' ? 'trophy' : 'star'} size={22} />
        {view.headline}
      </p>

      <div className="celebrate__facts">
        {view.facts.map((fact) => (
          <div className="celebrate__fact" key={fact.label}>
            <b>{fact.value}</b>
            <span>{fact.label}</span>
          </div>
        ))}
      </div>

      {says && (
        <p className="celebrate__says">
          <b>{profile.pet.name}: </b>
          {says}
        </p>
      )}
    </div>
  );
}

export function FeedbackSheet() {
  const { feedback, dispatch } = useStore();
  const [asking, setAsking] = useState(false);
  const close = () => dispatch({ type: 'feedback/clear' });

  if (!feedback) return null;

  const act = feedback.act;
  const run = () => {
    setAsking(false);
    if (act) dispatch(act.action);
  };

  return (
    <>
    <Sheet open onClose={close} title={feedback.title}>
      <div className="stack">
        {feedback.celebrate ? (
          <Celebrate view={feedback.celebrate} says={feedback.petLine} />
        ) : (
          <div className="feedback__head" style={{ color: TONE_COLOR[feedback.tone] }}>
            <Icon name={TONE_ICON[feedback.tone]} size={26} />
          </div>
        )}

        <ul className="feedback__lines">
          {feedback.lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>

        {feedback.statsDelta && <StatDelta delta={feedback.statsDelta} />}

        {feedback.petLine && !feedback.celebrate && (
          <PetSpeech line={feedback.petLine} explain={feedback.petExplain} size={68} />
        )}

        {feedback.nextStep && (
          <div className="nextstep">
            <Icon name="play" size={16} />
            <span>
              <b>Что дальше: </b>
              {feedback.nextStep}
            </span>
          </div>
        )}

        {/* Действие остаётся главной кнопкой, «Понятно» уходит на второй
            план: так шаг делается в один тап, а не теряется за закрытием. */}
        {act && (
          <button className="btn" onClick={() => (act.confirm ? setAsking(true) : run())}>
            {act.label}
          </button>
        )}

        <button className={act ? 'btn btn--secondary' : 'btn'} onClick={close}>
          {feedback.celebrate ? 'Ура!' : 'Понятно'}
        </button>
      </div>
    </Sheet>

    {/* Вопрос стоит рядом с окном, а не внутри него: вложенное окно
        считало бы свои координаты от съезжающей шторки. */}
    {act?.confirm && (
      <Confirm
        open={asking}
        title={act.confirm.title}
        confirmLabel="Отложить"
        onConfirm={run}
        onCancel={() => setAsking(false)}
      >
        {act.confirm.body}
      </Confirm>
    )}
    </>
  );
}
