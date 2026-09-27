/**
 * Смена приветствия на главном экране.
 *
 * Работает как мешочек с фразами: все фразы питомца перемешиваются и
 * выдаются по одной при каждом заходе на главный экран. Пока мешочек не
 * опустеет, фразы не повторяются; при новом круге первая фраза никогда
 * не совпадает с последней прозвучавшей – две одинаковые подряд невозможны.
 *
 * Состояние мешочка – удобство, а не прогресс: оно лежит в localStorage
 * отдельно от профиля, и если его нет, игра просто начинает новый круг.
 */

import { species as speciesById } from '../content/pets';
import type { SpeciesId } from '../engine/types';

const KEY = 'finni.greet.v1';

export interface GreetingBag {
  species: string;
  /** Индексы фраз, которые ещё не прозвучали в этом круге. */
  queue: number[];
  /** Индекс последней показанной фразы. */
  last: number | null;
}

/** Перемешивание Фишера – Йетса. */
function shuffled(size: number, rand: () => number): number[] {
  const a = Array.from({ length: size }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Берёт следующую фразу из мешочка. Чистая функция – удобно тестировать.
 * Возвращает индекс фразы и новое состояние мешочка.
 */
export function drawGreeting(
  bag: GreetingBag | null,
  species: string,
  size: number,
  rand: () => number = Math.random
): { index: number; bag: GreetingBag } {
  const sameSpecies = bag !== null && bag.species === species;
  const last = sameSpecies ? bag.last : null;
  let queue = sameSpecies ? bag.queue.filter((i) => i < size) : [];

  if (queue.length === 0) {
    queue = shuffled(size, rand);
    // Новый круг не начинается с той же фразы, которой закончился прошлый.
    if (size > 1 && queue[0] === last) {
      [queue[0], queue[1]] = [queue[1], queue[0]];
    }
  }

  const [index, ...rest] = queue;
  return { index, bag: { species, queue: rest, last: index } };
}

function readBag(): GreetingBag | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as GreetingBag) : null;
  } catch {
    return null;
  }
}

function writeBag(bag: GreetingBag): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(bag));
  } catch {
    /* без хранилища просто начнём новый круг в следующий раз */
  }
}

/**
 * В режиме разработки React намеренно вызывает инициализаторы дважды.
 * Чтобы один заход не «съедал» две фразы, повторный вызов в течение
 * короткого окна возвращает ту же фразу. Человек не успевает уйти
 * с главного экрана и вернуться быстрее.
 */
const SAME_VISIT_MS = 400;
let lastDraw: { species: SpeciesId; text: string; at: number } | null = null;

/** Следующее приветствие питомца. Вызывается один раз при каждом заходе на главный экран. */
export function nextGreeting(id: SpeciesId): string {
  const now = Date.now();
  if (lastDraw && lastDraw.species === id && now - lastDraw.at < SAME_VISIT_MS) {
    return lastDraw.text;
  }
  const bank = speciesById(id).phrases.greet;
  const { index, bag } = drawGreeting(readBag(), id, bank.length);
  writeBag(bag);
  lastDraw = { species: id, text: bank[index], at: now };
  return bank[index];
}
