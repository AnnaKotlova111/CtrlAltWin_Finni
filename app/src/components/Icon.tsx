/**
 * Единый набор иконок приложения.
 *
 * Иконки нарисованы художником в одном стиле: мягкие формы, тёмный контур,
 * цвета дизайн-кода. Готовые файлы лежат в `public/assets/icons`: у каждой
 * обрезаны поля и она вписана в общий квадрат, поэтому все иконки выглядят
 * одного размера.
 *
 * Метафоры взяты из дизайн-кода: монета вместо кошелька, цель вместо
 * инвестиций, дом вместо активов, лапка вместо профиля.
 *
 * Новая иконка добавляется в двух местах: файл WebP в `public/assets/icons`
 * и имя в списке ниже. Тест `icons.test.ts` следит, чтобы они совпадали.
 */

import type { CSSProperties } from 'react';

export const ICON_NAMES = [
  // ── Навигация и разделы ──────────────────────────────────
  'home', 'budget', 'shop', 'piggy', 'quests', 'progress', 'adult', 'settings', 'paw',
  // ── Действия ─────────────────────────────────────────────
  'back', 'chevron-left', 'chevron-right', 'close', 'check', 'plus', 'minus',
  'info', 'lock', 'refresh', 'trash', 'play', 'transfer',
  // ── Настроение питомца ───────────────────────────────────
  'mood-happy', 'mood-good', 'mood-soso', 'mood-sad',
  // ── Товары и предметы ────────────────────────────────────
  'bowl', 'drop', 'berries', 'brush', 'vitamins', 'blanket', 'ball', 'book',
  'poster', 'hat', 'garland', 'cake', 'gift',
  // ── Цели накопления ──────────────────────────────────────
  'target', 'scooter', 'tent', 'wave', 'telescope', 'shoe', 'skate', 'palette',
  'dice', 'blocks',
  // ── Прочее ───────────────────────────────────────────────
  'shield', 'heart', 'star', 'trophy', 'calendar', 'history', 'glossary',
  'coin', 'warning',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

const KNOWN = new Set<string>(ICON_NAMES);

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** Иконка сама по себе несёт смысл – тогда у неё есть подпись. */
  title?: string;
}

export function Icon({ name, size = 24, className, style, title }: IconProps) {
  return (
    <img
      src={`./assets/icons/${name}.webp`}
      width={size}
      height={size}
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      draggable={false}
      className={className}
      style={{ flex: 'none', display: 'block', objectFit: 'contain', ...style }}
    />
  );
}

/** Подстраховка: если контент сослался на несуществующую иконку, покажем звезду. */
export function safeIcon(name: string): IconName {
  return (KNOWN.has(name) ? name : 'star') as IconName;
}
