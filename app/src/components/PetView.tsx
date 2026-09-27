/**
 * Питомец в комнате – главный визуальный объект приложения.
 *
 * Комната – атмосфера, коврик – сцена, питомец – главный герой.
 * Фон слегка размыт, питомец остаётся резким.
 *
 * Реплика питомца стоит в потоке над ним, а не поверх: сцена вырастает
 * под длину текста, и ни реплика, ни карточки ниже не закрывают питомца.
 *
 * Сверху может висеть строка `hud` – баланс и кнопка бонуса, как в играх.
 * Она лежит поверх комнаты, а сцена получает запас сверху, чтобы строка
 * ничего не закрывала.
 */

import type { ReactNode } from 'react';

import { petSprite, species } from '../content/pets';
import type { ColorId, SpeciesId, Stage } from '../engine/types';

export function PetView({
  speciesId,
  color,
  stage,
  animated = true,
  speech,
  hud,
}: {
  speciesId: SpeciesId;
  color: ColorId;
  stage: Stage;
  animated?: boolean;
  /** Реплика над головой питомца. */
  speech?: ReactNode;
  /** Строка поверх комнаты: баланс и быстрые действия. */
  hud?: ReactNode;
}) {
  const s = species(speciesId);
  const alt = `${s.name}, стадия ${stage}: ${s.stageNames[stage - 1]}`;

  return (
    <div className={`petview ${hud ? 'petview--hud' : ''}`}>
      <div className="petview__room" aria-hidden="true" />
      {hud && <div className="petview__hud">{hud}</div>}
      {speech && <div className="petview__speech">{speech}</div>}
      <div className="petview__stage">
        <div className="petview__rug" aria-hidden="true" />
        <img
          className={`petview__pet ${animated ? 'petview__pet--float' : ''}`}
          src={petSprite(speciesId, color, stage)}
          alt={alt}
          loading="eager"
          decoding="async"
        />
      </div>
    </div>
  );
}

/** Маленький портрет питомца – для списков, окна пояснений и экрана выбора. */
export function PetPortrait({
  speciesId,
  color,
  stage = 1,
  size = 84,
}: {
  speciesId: SpeciesId;
  color: ColorId;
  stage?: Stage;
  size?: number;
}) {
  return (
    <img
      className="petportrait"
      src={petSprite(speciesId, color, stage)}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      loading="lazy"
      decoding="async"
    />
  );
}
