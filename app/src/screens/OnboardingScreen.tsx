/**
 * Первый запуск: заставка, знакомство и создание локального профиля.
 *
 * Настоящее имя, телефон и почта не спрашиваются – только игровое имя
 * и выбранный питомец. Регистрации нет.
 *
 * Питомец выбирается каруселью: свайпом влево-вправо или стрелками
 * по бокам. Под питомцем – его характер.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { Icon } from '../components/Icon';
import { PetPortrait } from '../components/PetView';
import { Coin } from '../components/ui';
import { SPECIES } from '../content/pets';
import { INCOME_FIRST } from '../engine/constants';
import { money } from '../engine/economy';
import { useStore } from '../state/store';
import type { ColorId } from '../engine/types';

/** Шаги после заставки. Заставка нумерации не имеет – она вступление. */
const STEPS = ['Знакомство', 'Имя игрока', 'Питомец', 'Окрас', 'Имя питомца'] as const;

export function OnboardingScreen() {
  const { dispatch } = useStore();
  const [step, setStep] = useState(-1); // -1 – заставка
  const [playerName, setPlayerName] = useState('');
  const [petIndex, setPetIndex] = useState(0);
  const [color, setColor] = useState<ColorId>('base');
  const [petName, setPetName] = useState('');

  const current = SPECIES[petIndex];

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const finish = () =>
    dispatch({
      type: 'create',
      payload: {
        playerName: playerName.trim() || 'Игрок',
        species: current.id,
        color,
        petName: petName.trim() || current.name,
        isTest: false,
      },
    });

  const startDemo = () =>
    dispatch({
      type: 'create',
      payload: { playerName: 'Эксперт', species: 'finni', color: 'base', petName: 'Финни', isTest: true },
    });

  /* ───────────────── Заставка ───────────────── */
  if (step === -1) {
    return (
      <div className="splashscreen">
        <div className="splashscreen__art">
          <img src="./assets/ui/splash.webp" alt="Питомец Финни" />
          <button className="splashscreen__cta" onClick={() => setStep(0)}>
            Начать
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen screen--onboarding">
      <div className="onb__progress" aria-label={`Шаг ${step + 1} из ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <span key={s} className={`onb__dot ${i <= step ? 'is-on' : ''}`} />
        ))}
      </div>

      {step === 0 && (
        <div className="stack onb__intro">
          {/* Питомец, а не значок приложения: у значка есть фиолетовая
              подложка, и она выглядела лишним кружком посреди экрана. */}
          <img
            src="./assets/pets/finni-base-1.webp"
            alt=""
            width={132}
            height={132}
            style={{ alignSelf: 'center', objectFit: 'contain' }}
          />
          <h1 className="center">Как это работает</h1>
          <p className="center">
            Ты получаешь финкоины и решаешь, куда их направить. От твоих решений зависит,
            как себя чувствует питомец и как он растёт
          </p>

          <p className="center muted">
            Игра идёт неделями. В начале недели приходят финкоины, в конце вы с питомцем
            подводите итоги. Неделя здесь игровая: она закончится, когда ты нажмёшь
            «Подведём итоги», а не через семь настоящих дней
          </p>

          <div className="card card--hero stack--tight stack">
            <h3>Каждую неделю у тебя три решения</h3>
            <div className="decision">
              <span className="decision__icon decision__icon--needs">
                <Icon name="bowl" size={22} />
              </span>
              <span>
                <b>Потратить на обязательное</b>
                <span className="muted"> – еда и уход. Без этого питомцу плохо</span>
              </span>
            </div>
            <div className="decision">
              <span className="decision__icon decision__icon--wants">
                <Icon name="ball" size={22} />
              </span>
              <span>
                <b>Потратить на желаемое</b>
                <span className="muted"> – игрушки и красивое. Можно и отложить на потом</span>
              </span>
            </div>
            <div className="decision">
              <span className="decision__icon decision__icon--savings">
                <Icon name="piggy" size={22} />
              </span>
              <span>
                <b>Отложить</b>
                <span className="muted"> – в копилку на цель. Маленькие суммы тоже работают</span>
              </span>
            </div>
          </div>

          <p className="muted center">
            <Coin size={15} /> Финкоины – игровые. Они не продаются и не меняются на настоящие деньги
          </p>

          <button className="btn" onClick={next}>
            Дальше
          </button>
          <button className="btn btn--ghost" onClick={startDemo}>
            Демонстрационный режим
          </button>
          <p className="muted center" style={{ fontSize: 13 }}>
            Демонстрационный режим – для экспертной проверки: все задания открыты,
            недели переключаются без ожидания
          </p>
        </div>
      )}

      {step === 1 && (
        <div className="stack">
          <h1>Как тебя зовут в игре?</h1>
          <p className="muted">Придумай игровое имя. Настоящее имя, телефон и почта не нужны</p>
          <input
            className="field"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value.slice(0, 16))}
            placeholder="Например, Котик"
            maxLength={16}
            autoFocus
            aria-label="Игровое имя"
          />
          <div className="btn-row">
            <button className="btn btn--secondary" onClick={back}>
              Назад
            </button>
            <button className="btn" onClick={next}>
              Дальше
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="stack">
          <h1>Выбери питомца</h1>
          <p className="muted">
            Листай влево и вправо – у каждого свой характер. Он будет комментировать твои
            финансовые решения по-своему
          </p>

          <PetCarousel
            index={petIndex}
            onChange={(i) => {
              setPetIndex(i);
              setColor('base');
            }}
          />

          <div className="btn-row">
            <button className="btn btn--secondary" onClick={back}>
              Назад
            </button>
            <button className="btn" onClick={next}>
              Беру {current.name}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="stack">
          <h1>Какой окрас?</h1>
          <p className="muted">{current.philosophy}</p>
          <div className="petpreview">
            <PetPortrait speciesId={current.id} color={color} size={190} />
          </div>
          <div className="colorrow">
            {current.colors.map((c) => (
              <button
                key={c.id}
                className={`colorbtn ${c.id === color ? 'is-on' : ''}`}
                onClick={() => setColor(c.id)}
                aria-pressed={c.id === color}
              >
                <span className="colorbtn__dot" style={{ background: c.accent }} />
                {c.label}
              </button>
            ))}
          </div>
          <div className="btn-row">
            <button className="btn btn--secondary" onClick={back}>
              Назад
            </button>
            <button className="btn" onClick={next}>
              Дальше
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="stack">
          <h1>Как назовёшь питомца?</h1>
          <div className="petpreview">
            <PetPortrait speciesId={current.id} color={color} size={190} />
          </div>
          <input
            className="field"
            value={petName}
            onChange={(e) => setPetName(e.target.value.slice(0, 16))}
            placeholder={current.name}
            maxLength={16}
            autoFocus
            aria-label="Имя питомца"
          />
          <div className="card card--soft">
            <b>Стартовый бюджет:</b> {money(INCOME_FIRST)}. Их ты распределишь на первой неделе
          </div>
          <div className="btn-row">
            <button className="btn btn--secondary" onClick={back}>
              Назад
            </button>
            <button className="btn" onClick={finish}>
              Играть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════ Карусель питомцев ═══════════════════ */

/** Насколько нужно протащить палец, чтобы карточка перелистнулась. */
const SWIPE_THRESHOLD = 48;

function PetCarousel({ index, onChange }: { index: number; onChange: (i: number) => void }) {
  const [drag, setDrag] = useState(0);
  const dragging = useRef(false);
  const startX = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);

  const last = SPECIES.length - 1;
  const pet = SPECIES[index];

  const go = useCallback(
    (delta: number) => {
      const i = Math.max(0, Math.min(last, index + delta));
      if (i !== index) onChange(i);
    },
    [index, last, onChange]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - startX.current;
    // У краёв карусель сопротивляется – видно, что дальше ничего нет.
    const atEdge = (dx > 0 && index === 0) || (dx < 0 && index === last);
    setDrag(atEdge ? dx * 0.28 : dx);
  };

  const finishDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (drag <= -SWIPE_THRESHOLD) go(1);
    else if (drag >= SWIPE_THRESHOLD) go(-1);
    setDrag(0);
  };

  // Стрелки на клавиатуре – для тех, кто не пользуется мышью и касанием.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(1);
    }
  };

  // Сбрасываем незавершённый свайп, если палец «ушёл» за пределы окна.
  useEffect(() => {
    const cancel = () => {
      dragging.current = false;
      setDrag(0);
    };
    window.addEventListener('pointercancel', cancel);
    return () => window.removeEventListener('pointercancel', cancel);
  }, []);

  const width = stageRef.current?.offsetWidth ?? 1;
  const shift = -index * 100 + (drag / width) * 100;

  return (
    <div className="carousel">
      <div
        className="carousel__stage"
        ref={stageRef}
        role="group"
        aria-roledescription="карусель"
        aria-label="Выбор питомца"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerLeave={finishDrag}
      >
        <div
          className="carousel__track"
          style={{
            transform: `translateX(${shift}%)`,
            transition: dragging.current ? 'none' : undefined,
          }}
        >
          {SPECIES.map((s, i) => (
            <div className="carousel__slide" key={s.id} aria-hidden={i !== index}>
              <PetPortrait speciesId={s.id} color="base" size={190} />
            </div>
          ))}
        </div>

        <button
          className="carousel__arrow carousel__arrow--left"
          onClick={() => go(-1)}
          disabled={index === 0}
          aria-label="Предыдущий питомец"
        >
          <Icon name="chevron-left" size={40} />
        </button>
        <button
          className="carousel__arrow carousel__arrow--right"
          onClick={() => go(1)}
          disabled={index === last}
          aria-label="Следующий питомец"
        >
          <Icon name="chevron-right" size={40} />
        </button>
      </div>

      <div className="carousel__dots" role="tablist" aria-label="Питомцы">
        {SPECIES.map((s, i) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={i === index}
            aria-label={s.name}
            className={`carousel__dot ${i === index ? 'is-on' : ''}`}
            onClick={() => onChange(i)}
          />
        ))}
      </div>

      {/* Характер питомца. aria-live – чтобы смена читалась вслух. */}
      <div className="petchar" aria-live="polite">
        <h2>{pet.name}</h2>
        <p className="petchar__tagline">{pet.tagline}</p>
        <p className="petchar__quote">«{pet.philosophy}»</p>
        <p className="petchar__focus">
          <Icon name="star" size={15} />
          <span>
            <b>Научит: </b>
            {pet.focus.toLowerCase()}
          </span>
        </p>
        <p className="muted petchar__counter">
          {index + 1} из {SPECIES.length}
        </p>
      </div>
    </div>
  );
}
