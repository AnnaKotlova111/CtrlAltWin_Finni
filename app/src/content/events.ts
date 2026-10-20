/**
 * Специально спланированные события игровых недель.
 *
 * Правило: событие не пугает и не наказывает. Непредвиденный расход –
 * это учебная ситуация «как найти деньги», а не болезнь или беда.
 * Есть и приятные события – нерегулярный доход.
 */

export type EventKind = 'expense' | 'income';

export interface PeriodEventOption {
  id: string;
  title: string;
  note?: string;
  /** Откуда берутся финкоины: с баланса или из копилки. */
  from: 'balance' | 'savings' | 'postpone';
  outcome: string;
}

export interface PeriodEvent {
  id: string;
  kind: EventKind;
  /** На какой игровой неделе событие появляется. */
  period: number;
  title: string;
  text: string;
  amount: number;
  icon: string;
  /** Только для расходных событий. */
  options?: PeriodEventOption[];
  competencies: string[];
}

export const PERIOD_EVENTS: PeriodEvent[] = [
  {
    id: 'granny',
    kind: 'income',
    period: 2,
    title: 'Подарок от бабушки',
    text: 'Бабушка прислала питомцу 50 Φ просто так. Такой доход называется нерегулярным: он приходит не каждую неделю',
    amount: 50,
    icon: 'gift',
    competencies: ['ПО2.БЮД.З.Б2', 'ПО2.БЮД.З.П1'],
  },
  {
    id: 'checkup',
    kind: 'expense',
    period: 3,
    title: 'Плановый осмотр',
    text: 'Питомцу пора на обычный осмотр к доброму доктору. Это стоит 60 Φ',
    amount: 60,
    icon: 'heart',
    options: [
      {
        id: 'balance',
        title: 'Оплатить с баланса',
        note: 'Сократить необязательное',
        from: 'balance',
        outcome: 'Осмотр оплачен, копилка не тронута. Так поступают, когда есть свободные финкоины',
      },
      {
        id: 'savings',
        title: 'Взять из копилки',
        note: 'Цель отодвинется',
        from: 'savings',
        outcome: 'Осмотр оплачен, но до цели стало дальше. Копилка для этого не предназначена',
      },
      {
        id: 'postpone',
        title: 'Перенести на следующую неделю',
        note: 'Расход никуда не денется',
        from: 'postpone',
        outcome: 'Осмотр перенесён. Комфорт питомца чуть снизился, а трата вернётся на следующей неделе',
      },
    ],
    competencies: ['ПО2.ФБ.З.Б1', 'ПО2.ФБ.З.П1', 'ПО2.БЮД.У.П3'],
  },
  {
    id: 'rug',
    kind: 'expense',
    period: 4,
    title: 'Коврик протёрся',
    text: 'Любимый коврик питомца совсем истрепался. Новый стоит 45 Φ',
    amount: 45,
    icon: 'blanket',
    options: [
      {
        id: 'balance',
        title: 'Купить новый с баланса',
        from: 'balance',
        outcome: 'Коврик заменён, в комнате снова уютно',
      },
      {
        id: 'savings',
        title: 'Взять из копилки',
        note: 'Цель отодвинется',
        from: 'savings',
        outcome: 'Коврик есть, но копилка похудела',
      },
      {
        id: 'postpone',
        title: 'Пока обойтись',
        note: 'Комфорт снизится',
        from: 'postpone',
        outcome: 'Питомец не расстроился, но на полу стало прохладнее',
      },
    ],
    competencies: ['ПО2.ФБ.У.Б1', 'ПО2.БЮД.У.П3'],
  },
  {
    // Событие не приписывает ребёнку поступок, которого могло не быть:
    // работает питомец, а ребёнок распоряжается заработанным.
    id: 'fair',
    kind: 'income',
    period: 5,
    title: 'Ярмарка во дворе',
    text: 'Во дворе устроили ярмарку поделок, и питомец целый день помогал за прилавком. За работу питомцу дали 40 Φ. Это заработанные деньги: они приходят за труд, а не просто так',
    amount: 40,
    icon: 'star',
    competencies: ['ПО2.БЮД.З.Б2'],
  },
];

export function eventForPeriod(period: number): PeriodEvent | null {
  return PERIOD_EVENTS.find((e) => e.period === period) ?? null;
}

export function periodEvent(id: string): PeriodEvent {
  const e = PERIOD_EVENTS.find((x) => x.id === id);
  if (!e) throw new Error(`Неизвестное событие: ${id}`);
  return e;
}
