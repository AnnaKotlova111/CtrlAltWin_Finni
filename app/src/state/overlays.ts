/**
 * Окна поверх экрана: подтверждения, обратная связь, подсказки.
 *
 * Системная кнопка «назад» должна сначала закрывать такое окно и только
 * потом возвращать на предыдущий экран – иначе ребёнок нажимает «назад»,
 * окно остаётся на месте, а экран под ним незаметно меняется.
 *
 * Список ведётся по порядку открытия: закрывается всегда верхнее.
 */

const openOverlays: (() => void)[] = [];

/** Окно открылось. Возвращает функцию, которую нужно вызвать при закрытии. */
export function registerOverlay(close: () => void): () => void {
  openOverlays.push(close);
  return () => {
    const i = openOverlays.lastIndexOf(close);
    if (i >= 0) openOverlays.splice(i, 1);
  };
}

/** Закрывает верхнее окно. `true` – если было что закрывать. */
export function closeTopOverlay(): boolean {
  const close = openOverlays.pop();
  if (!close) return false;
  close();
  return true;
}
