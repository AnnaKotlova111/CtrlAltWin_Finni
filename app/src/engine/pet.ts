/**
 * Состояние и развитие питомца.
 *
 * Состояние (настроение, сытость, комфорт) меняется после каждого
 * финансового решения. Развитие (стадия) зависит от совокупности решений
 * за несколько недель и никогда не откатывается назад.
 */

import { FULLNESS_OK, STAGE_THRESHOLDS } from './constants';
import type { PetStats, Stage } from './types';

/** Какая стадия соответствует накопленным очкам развития. */
export function stageForGrowth(growth: number): Stage {
  if (growth >= STAGE_THRESHOLDS[3]) return 3;
  if (growth >= STAGE_THRESHOLDS[2]) return 2;
  return 1;
}

/** Сколько очков осталось до следующей стадии. null – стадия последняя. */
export function growthToNextStage(growth: number): { need: number; total: number } | null {
  const stage = stageForGrowth(growth);
  if (stage === 3) return null;
  const next = STAGE_THRESHOLDS[(stage + 1) as Stage];
  const from = STAGE_THRESHOLDS[stage];
  return { need: next - growth, total: next - from };
}

/** Русское склонение слова «очко» – про очки развития питомца. */
export function pointsWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'очко';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'очка';
  return 'очков';
}

/** Прогресс до следующей стадии, 0…1. */
export function stageProgress(growth: number): number {
  const stage = stageForGrowth(growth);
  if (stage === 3) return 1;
  const from = STAGE_THRESHOLDS[stage];
  const next = STAGE_THRESHOLDS[(stage + 1) as Stage];
  return Math.max(0, Math.min(1, (growth - from) / (next - from)));
}

export type MoodLabel = 'happy' | 'good' | 'soso' | 'sad';

/** Словесное описание настроения. Цвет не единственный способ его передать. */
export function moodLabel(stats: PetStats): { key: MoodLabel; title: string; icon: string } {
  const avg = (stats.mood + stats.fullness + stats.comfort) / 3;
  if (avg >= 75) return { key: 'happy', title: 'Отличное', icon: 'mood-happy' };
  if (avg >= 55) return { key: 'good', title: 'Хорошее', icon: 'mood-good' };
  if (avg >= 35) return { key: 'soso', title: 'Так себе', icon: 'mood-soso' };
  return { key: 'sad', title: 'Грустное', icon: 'mood-sad' };
}

/**
 * Причины настроения по порядку: ребёнку показывается первая подходящая.
 *
 * `toShop` – нужно ли из этой строки вести в лавку. Когда питомцу чего-то
 * не хватает, причина упирается в покупки. Когда всё хорошо, идти в лавку
 * незачем, и строка остаётся просто объяснением.
 */
const MOOD_REASONS: { fits: (stats: PetStats) => boolean; text: string; toShop: boolean }[] = [
  {
    fits: (stats) => stats.fullness < FULLNESS_OK,
    text: 'Питомец проголодался – не хватает обязательных покупок',
    toShop: true,
  },
  {
    fits: (stats) => stats.comfort < 35,
    text: 'В комнате неуютно: давно не было покупок на уход',
    toShop: true,
  },
  {
    fits: (stats) => stats.mood < 35,
    text: 'Давно не было ничего приятного – настроение просело',
    toShop: true,
  },
  {
    fits: (stats) => stats.mood >= 75 && stats.fullness >= 75,
    text: 'Питомец сыт и доволен: обязательное закрыто, приятное тоже было',
    toShop: false,
  },
  {
    fits: () => true,
    text: 'Всё в порядке: обязательное закрыто, настроение ровное',
    toShop: false,
  },
];

function moodCase(stats: PetStats) {
  return MOOD_REASONS.find((reason) => reason.fits(stats)) ?? MOOD_REASONS[MOOD_REASONS.length - 1];
}

/**
 * Короткое объяснение, почему настроение именно такое.
 * Ребёнку всегда видно причину изменения.
 */
export function moodReason(stats: PetStats): string {
  return moodCase(stats).text;
}

/** Есть ли в этой причине то, что лечится покупкой. */
export function moodNeedsShop(stats: PetStats): boolean {
  return moodCase(stats).toShop;
}

export const STAT_TITLES: Record<keyof PetStats, string> = {
  mood: 'Настроение',
  fullness: 'Сытость',
  comfort: 'Комфорт',
};

export const STAT_ICONS: Record<keyof PetStats, string> = {
  mood: 'mood-good',
  fullness: 'bowl',
  comfort: 'blanket',
};
