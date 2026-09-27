/**
 * Окно обратной связи.
 *
 * Показывается после каждого финансового действия и отвечает на вопрос
 * «что изменилось и почему», а затем предлагает следующий шаг.
 * Реплики и пояснения произносит питомец ребёнка – с его портретом.
 */

import { useStore } from '../state/store';
import { STAT_TITLES } from '../engine/pet';
import { Icon, type IconName } from './Icon';
import { PetSpeech } from './PetSpeech';
import { Sheet } from './ui';
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

export function FeedbackSheet() {
  const { feedback, dispatch } = useStore();
  const close = () => dispatch({ type: 'feedback/clear' });

  if (!feedback) return null;

  return (
    <Sheet open onClose={close} title={feedback.title}>
      <div className="stack">
        <div className="feedback__head" style={{ color: TONE_COLOR[feedback.tone] }}>
          <Icon name={TONE_ICON[feedback.tone]} size={26} />
        </div>

        <ul className="feedback__lines">
          {feedback.lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>

        {feedback.statsDelta && <StatDelta delta={feedback.statsDelta} />}

        {feedback.petLine && (
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

        <button className="btn" onClick={close}>
          Понятно
        </button>
      </div>
    </Sheet>
  );
}
