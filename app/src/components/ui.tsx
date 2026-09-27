/**
 * Мелкие переиспользуемые части интерфейса.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { Icon, safeIcon, type IconName } from './Icon';
import { CURRENCY } from '../engine/constants';
import { registerOverlay } from '../state/overlays';

/** Знак игровой валюты – картинка финкоина. */
export function Coin({ size = 18 }: { size?: number }) {
  return (
    <img
      src="./assets/ui/fincoin-sm.webp"
      alt=""
      aria-hidden="true"
      className="coin"
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
}

/** Сумма в финкоинах. Крупные показатели должны считываться сразу. */
export function Money({
  value,
  big,
  showCoin = true,
  sign,
}: {
  value: number;
  big?: boolean;
  showCoin?: boolean;
  sign?: boolean;
}) {
  const rounded = Math.round(value);
  const text = Math.abs(rounded).toLocaleString('ru-RU').replace(/\u00A0/g, ' ');
  const prefix = sign ? (rounded > 0 ? '+' : rounded < 0 ? '−' : '') : rounded < 0 ? '−' : '';
  return (
    <span className={big ? 'money money--big' : 'money'}>
      {showCoin && <Coin size={big ? 30 : 17} />}
      {prefix}
      {text} <span className="money__unit">{CURRENCY}</span>
    </span>
  );
}

/** Шапка экрана. Кнопка «назад» всегда в одном месте – слева. */
export function TopBar({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <header className="topbar">
      {onBack ? (
        <button className="iconbtn" onClick={onBack} aria-label="Назад">
          <Icon name="back" size={22} />
        </button>
      ) : (
        <span style={{ width: 0 }} />
      )}
      <span className="topbar__title">
        {title}
        {subtitle && <span className="topbar__sub">{subtitle}</span>}
      </span>
      {right}
    </header>
  );
}

/**
 * Показатель питомца кольцом: число сверху, кольцо со значком, подпись снизу.
 * Три таких кольца в ряд занимают меньше места, чем три полосы друг под другом,
 * и читаются с одного взгляда. Цвет – не единственный признак: рядом всегда
 * есть значок, число и подпись.
 */
export function StatRing({
  icon,
  title,
  value,
  color,
}: {
  icon: IconName;
  title: string;
  value: number;
  color: string;
}) {
  const level = Math.max(0, Math.min(100, Math.round(value)));
  const radius = 30;
  const length = 2 * Math.PI * radius;

  return (
    <div className="statring" role="group" aria-label={`${title}: ${level} из 100`}>
      <span className="statring__value">{level}</span>
      <span className="statring__dial">
        <svg viewBox="0 0 72 72" aria-hidden="true">
          <circle className="statring__track" cx="36" cy="36" r={radius} />
          <circle
            className="statring__fill"
            cx="36"
            cy="36"
            r={radius}
            stroke={color}
            strokeDasharray={length}
            strokeDashoffset={length * (1 - level / 100)}
          />
        </svg>
        <Icon name={icon} size={22} className="statring__icon" />
      </span>
      <span className="statring__title">{title}</span>
    </div>
  );
}

/** Категория расхода: цвет плюс иконка плюс слово. */
export function KindBadge({ kind }: { kind: 'needs' | 'wants' }) {
  return (
    <span className={`badge badge--${kind}`}>
      <Icon name={kind === 'needs' ? 'check' : 'star'} size={16} />
      {kind === 'needs' ? 'Обязательное' : 'Желаемое'}
    </span>
  );
}

/** Плитка с иконкой товара или цели. */
export function Thumb({ icon, tone = 'lavender' }: { icon: string; tone?: 'lavender' | 'gold' | 'green' }) {
  const bg = tone === 'gold' ? '#fff1cf' : tone === 'green' ? '#e3f1e4' : 'var(--lavender-soft)';
  const fg = tone === 'gold' ? 'var(--gold-dark)' : tone === 'green' ? '#3d7a42' : 'var(--purple)';
  return (
    <span className="thumb" style={{ background: bg, color: fg }}>
      <Icon name={safeIcon(icon)} size={26} />
    </span>
  );
}

/** Модальное окно снизу. Используется для подтверждений и объяснений. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  closeLabel = 'Закрыть',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  closeLabel?: string;
}) {
  useEffect(() => {
    if (!open) return;
    // Пока окно открыто, системная кнопка «назад» закрывает его, а не экран.
    const unregister = registerOverlay(onClose);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      unregister();
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="sheet-root" role="dialog" aria-modal="true" aria-label={title}>
      <button className="sheet-backdrop" onClick={onClose} aria-label={closeLabel} />
      <div className="sheet">
        <div className="sheet__grip" aria-hidden="true" />
        <h2 className="sheet__title">{title}</h2>
        <div className="sheet__body">{children}</div>
      </div>
    </div>
  );
}

/**
 * Подтверждение действия. Всё, что заметно меняет прогресс,
 * проходит через это окно (ТЗ 3.6).
 */
export function Confirm({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
  danger,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  return (
    <Sheet open={open} onClose={onCancel} title={title}>
      <div className="stack">
        <div className="muted" style={{ fontSize: 'var(--fs-base)', color: 'var(--ink)' }}>
          {children}
        </div>
        <div className="btn-row">
          <button className="btn btn--secondary" onClick={onCancel}>
            Отмена
          </button>
          <button className={danger ? 'btn btn--danger' : 'btn'} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/** Кнопка-степпер для сумм: крупные цели нажатия, без клавиатуры. */
export function Stepper({
  value,
  step,
  min = 0,
  max,
  onChange,
  label,
}: {
  value: number;
  step: number;
  min?: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
}) {
  /*
   * Сумму можно набрать прямо на клавиатуре: нажимать плюс сто раз,
   * чтобы отложить 500 Φ, никто не станет. Пока поле в фокусе, показываем
   * то, что набирает ребёнок, и проверяем число только при выходе из поля –
   * иначе первое же стирание цифры превратилось бы в ноль.
   */
  const [draft, setDraft] = useState<string | null>(null);
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));

  const commit = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, '');
    const n = digits === '' ? min : Number(digits);
    onChange(Math.min(max, Math.max(min, n)));
    setDraft(null);
  };

  const shown = draft ?? String(value);

  return (
    <div className="stepper">
      <button
        className="iconbtn"
        onClick={dec}
        disabled={value <= min}
        aria-label={`Уменьшить: ${label}`}
      >
        <Icon name="minus" size={20} />
      </button>
      <span className="stepper__value">
        <input
          className="stepper__input"
          type="text"
          inputMode="numeric"
          value={shown}
          size={Math.max(1, shown.length)}
          aria-label={`${label}: сумма`}
          onFocus={(e) => {
            setDraft(String(value));
            e.target.select();
          }}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
        <span className="stepper__unit">{CURRENCY}</span>
      </span>
      <button
        className="iconbtn"
        onClick={inc}
        disabled={value >= max}
        aria-label={`Увеличить: ${label}`}
      >
        <Icon name="plus" size={20} />
      </button>
    </div>
  );
}

/**
 * Быстрые суммы под степпером: прибавить фиксированно или забрать весь
 * нераспределённый остаток. Ребёнку не нужно жать плюс десять раз,
 * а точность – в отличие от бегунка – не теряется.
 */
export function QuickAmounts({
  value,
  max,
  steps = [50, 100],
  onChange,
  label,
}: {
  value: number;
  /** Потолок: больше этого в направление не положить. */
  max: number;
  steps?: number[];
  onChange: (v: number) => void;
  label: string;
}) {
  const rest = Math.max(0, max - value);
  return (
    <div className="quickrow">
      {steps.map((step) => (
        <button
          key={step}
          className="quick"
          disabled={rest < step}
          onClick={() => onChange(Math.min(max, value + step))}
          aria-label={`${label}: добавить ${step} ${CURRENCY}`}
        >
          +{step}
        </button>
      ))}
      <button
        className="quick quick--all"
        disabled={rest === 0}
        onClick={() => onChange(max)}
        aria-label={`${label}: добавить весь остаток`}
      >
        Весь остаток
      </button>
    </div>
  );
}

/** Подсказка-пояснение, которую можно открыть в любой момент. */
export function HintBlock({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="hint">
      <button className="hint__head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Icon name="info" size={20} />
        <span>{title}</span>
        <Icon name={open ? 'minus' : 'plus'} size={18} style={{ marginLeft: 'auto' }} />
      </button>
      {open && <div className="hint__body">{children}</div>}
    </div>
  );
}

/** Пустое состояние раздела – всегда с подсказкой, что сделать. */
export function Empty({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <div className="empty">
      <Icon name={icon} size={44} style={{ opacity: 0.7 }} />
      <h3>{title}</h3>
      <p className="muted">{text}</p>
    </div>
  );
}
