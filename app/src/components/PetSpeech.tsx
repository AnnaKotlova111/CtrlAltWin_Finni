/**
 * «Питомец говорит»: портрет питомца ребёнка, облачко с его репликой
 * и, при необходимости, подсказка под облачком.
 *
 * Реплика звучит голосом питомца – в его характере. Подсказка – спокойным
 * голосом рассказчика: она объясняет, как на самом деле стоит поступить,
 * если питомец тянет к неудачному решению. Так характер влияет на игру,
 * но ребёнок не учится неправильному.
 */

import { Icon } from './Icon';
import { PetPortrait } from './PetView';
import { useStore } from '../state/store';

export function PetSpeech({
  line,
  explain,
  note,
  size = 64,
  live = false,
}: {
  /** Реплика питомца в его характере. */
  line: string;
  /** Пояснение, которое питомец даёт сам (после ответа в задании). */
  explain?: string;
  /** Подсказка рассказчика под облачком. */
  note?: string;
  size?: number;
  /** Реплика меняется на лету – пусть экранный диктор её зачитывает. */
  live?: boolean;
}) {
  const { profile } = useStore();
  if (!profile) return null;
  const { pet } = profile;

  return (
    <div className="petspeech" aria-live={live ? 'polite' : undefined}>
      <div className="petsays">
        {/* Питомец стоит прямо на фоне экрана: подложка под ним спорила
            с облачком реплики. */}
        <span className="petsays__avatar">
          <PetPortrait
            speciesId={pet.species}
            color={pet.color}
            stage={pet.stage}
            size={Math.round(size * 0.86)}
          />
        </span>
        <div className="petsays__bubble">
          <b className="petsays__name">{pet.name}</b>
          <p className="petsays__line">{line}</p>
          {explain && <p className="petsays__explain">{explain}</p>}
        </div>
      </div>
      {note && (
        <div className="petsays__note">
          <Icon name="info" size={17} />
          <p>
            <b>Подсказка: </b>
            {note}
          </p>
        </div>
      )}
    </div>
  );
}
