/**
 * Каталог покупок: товары и действия для питомца.
 *
 * Два типа расходов:
 *   needs – обязательные: нужны регулярно, от них зависит состояние питомца;
 *   wants – необязательные: влияют на настроение, но отказ от них
 *           или перенос на следующую неделю не считается ошибкой.
 *
 * Перед покупкой ребёнок видит цену, категорию и предполагаемое влияние.
 */

import type { CostKind, PetStats } from '../engine/types';

export interface ShopItem {
  id: string;
  title: string;
  kind: CostKind;
  price: number;
  /** Старая цена – если на товар «скидка». Нужна, чтобы ребёнок
   *  научился считать выгоду, а не верить проценту на ценнике. */
  oldPrice?: number;
  icon: string;
  /** Как покупка повлияет на показатели питомца. */
  effects: Partial<PetStats>;
  /** Короткое понятное описание влияния – показывается до покупки. */
  impact: string;
  /** Почему это обязательный или необязательный расход. */
  why: string;
  /** Можно покупать каждую неделю (еда, уход) или только один раз. */
  repeatable: boolean;
  /** Компетенции, которые тренирует работа с этой позицией. */
  competencies: string[];
}

export const SHOP: ShopItem[] = [
  // ───────────── Обязательные расходы ─────────────
  {
    id: 'bowl',
    title: 'Миска каши',
    kind: 'needs',
    price: 30,
    icon: 'bowl',
    effects: { fullness: 30 },
    impact: 'Сытость +30',
    why: 'Еда нужна питомцу каждую неделю – без неё падает сытость',
    repeatable: true,
    competencies: ['ПО2.БЮД.У.Б2', 'ПО1.ЦТУ.З.Б1'],
  },
  {
    id: 'water',
    title: 'Свежая вода',
    kind: 'needs',
    price: 20,
    icon: 'drop',
    effects: { fullness: 12, comfort: 5 },
    impact: 'Сытость +12, комфорт +5',
    why: 'Самое дешёвое обязательное. С него удобно начинать план',
    repeatable: true,
    competencies: ['ПО2.БЮД.У.Б2'],
  },
  {
    id: 'berries',
    title: 'Свежие ягоды',
    kind: 'needs',
    price: 45,
    icon: 'berries',
    effects: { fullness: 40, mood: 5 },
    impact: 'Сытость +40, настроение +5',
    why: 'Еда подороже, но и сытости даёт больше. Есть из чего выбрать',
    repeatable: true,
    competencies: ['ПО1.ЦТУ.У.Б1', 'ПО1.ПП.У.Б2'],
  },
  {
    id: 'brush',
    title: 'Щётка для шёрстки',
    kind: 'needs',
    price: 40,
    icon: 'brush',
    effects: { comfort: 25 },
    impact: 'Комфорт +25',
    why: 'Уход – тоже обязательная трата, просто не такая заметная, как еда',
    repeatable: true,
    competencies: ['ПО2.БЮД.У.Б2'],
  },
  {
    id: 'vitamins',
    title: 'Витаминки',
    kind: 'needs',
    price: 35,
    icon: 'vitamins',
    effects: { fullness: 15, comfort: 10 },
    impact: 'Сытость +15, комфорт +10',
    why: 'Поддерживает питомца, когда обязательного куплено мало',
    repeatable: true,
    competencies: ['ПО2.БЮД.У.Б2'],
  },
  {
    id: 'blanket',
    title: 'Тёплый плед',
    kind: 'needs',
    price: 60,
    icon: 'blanket',
    effects: { comfort: 30 },
    impact: 'Комфорт +30',
    why: 'Покупается один раз и служит дальше – так тоже бывает с нужными вещами',
    repeatable: false,
    competencies: ['ПО2.БЮД.У.Б2', 'ПО1.ЦТУ.З.Б1'],
  },

  // ───────────── Необязательные расходы ─────────────
  {
    id: 'ball',
    title: 'Мячик-попрыгунчик',
    kind: 'wants',
    price: 50,
    icon: 'ball',
    effects: { mood: 20 },
    impact: 'Настроение +20',
    why: 'Приятная покупка. Её спокойно можно перенести на следующую неделю',
    repeatable: false,
    competencies: ['ПО2.БЮД.У.П4', 'ПО2.БЮД.Л.Б1'],
  },
  {
    id: 'book',
    title: 'Книжка с картинками',
    kind: 'wants',
    price: 55,
    icon: 'book',
    effects: { mood: 15, comfort: 5 },
    impact: 'Настроение +15, комфорт +5',
    why: 'Необязательная трата, но питомец её очень любит',
    repeatable: false,
    competencies: ['ПО2.БЮД.У.П4'],
  },
  {
    id: 'poster',
    title: 'Постер «Моя мечта»',
    kind: 'wants',
    price: 40,
    oldPrice: 44,
    icon: 'poster',
    effects: { mood: 10, comfort: 5 },
    impact: 'Настроение +10, комфорт +5',
    why: 'Ценник кричит «скидка», а выгода всего 4 Φ. Посчитай, прежде чем брать',
    repeatable: false,
    competencies: ['ПО1.ЦТУ.З.П1', 'ПО1.ПП.У.П3'],
  },
  {
    id: 'hat',
    title: 'Модная шапочка',
    kind: 'wants',
    price: 70,
    icon: 'hat',
    effects: { mood: 25 },
    impact: 'Настроение +25',
    why: 'Красиво. И дорого. Сначала посмотри, сколько осталось на обязательное',
    repeatable: false,
    competencies: ['ПО2.БЮД.У.П3', 'ПО2.БЮД.Л.П2'],
  },
  {
    id: 'garland',
    title: 'Гирлянда для комнаты',
    kind: 'wants',
    price: 90,
    icon: 'garland',
    effects: { mood: 15, comfort: 15 },
    impact: 'Настроение +15, комфорт +15',
    why: 'Делает комнату уютнее. Но это всё ещё необязательный расход',
    repeatable: false,
    competencies: ['ПО2.БЮД.У.П3'],
  },
  {
    id: 'cake',
    title: 'Праздничный торт',
    kind: 'wants',
    price: 120,
    oldPrice: 150,
    icon: 'cake',
    effects: { mood: 35, fullness: 10 },
    impact: 'Настроение +35, сытость +10',
    why: 'Здесь скидка настоящая – 30 Φ. Но и цена самая высокая в каталоге',
    repeatable: true,
    competencies: ['ПО1.ЦТУ.У.Б2', 'ПО1.ЦТУ.З.П1'],
  },
];

const BY_ID = new Map(SHOP.map((i) => [i.id, i]));

export function shopItem(id: string): ShopItem {
  const item = BY_ID.get(id);
  if (!item) throw new Error(`Неизвестный товар: ${id}`);
  return item;
}

export const NEEDS_ITEMS = SHOP.filter((i) => i.kind === 'needs');
export const WANTS_ITEMS = SHOP.filter((i) => i.kind === 'wants');

/** Самая дешёвая обязательная позиция – нужна для подсказок «на что хватит». */
export const CHEAPEST_NEED = NEEDS_ITEMS.reduce((a, b) => (a.price <= b.price ? a : b));
