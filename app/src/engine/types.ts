/**
 * Типы игровой модели.
 *
 * Здесь описаны только данные. Правила, по которым данные меняются,
 * лежат в src/engine/*.ts, учебный контент – в src/content/*.ts.
 */

/** Вид питомца. */
export type SpeciesId =
  | 'finni'
  | 'byks'
  | 'percentin'
  | 'rostik'
  | 'lucky'
  | 'pinky'
  | 'kashik';

/** Окрас питомца. У каждого вида свой набор – см. content/pets.ts. */
export type ColorId = 'base' | 'green' | 'blue' | 'yellow' | 'purple';

/** Стадия развития: 1 – малыш, 2 – подросток, 3 – взрослый. */
export type Stage = 1 | 2 | 3;

/** Направления, по которым ребёнок распределяет бюджет недели. */
export type Direction = 'needs' | 'wants' | 'savings';

/** Тип позиции в каталоге покупок. */
export type CostKind = 'needs' | 'wants';

/** Показатели состояния питомца, 0..100. */
export interface PetStats {
  /** Настроение – как питомец себя чувствует прямо сейчас. */
  mood: number;
  /** Сытость – закрыты ли обязательные расходы на еду. */
  fullness: number;
  /** Комфорт – зависит от ухода и предметов комнаты. */
  comfort: number;
}

/** Распределение суммы по трём направлениям. */
export interface Allocation {
  needs: number;
  wants: number;
  savings: number;
}

/** Запись о начислении игровой валюты: баланс не меняется без объяснения. */
export interface IncomeRecord {
  id: string;
  /** Откуда пришли финкоины. */
  source: string;
  amount: number;
  /** Номер игровой недели. */
  period: number;
  at: number;
}

/** Запись о покупке в истории недели. */
export interface PurchaseRecord {
  id: string;
  itemId: string;
  title: string;
  price: number;
  kind: CostKind;
  period: number;
  at: number;
}

/** Запись о движении в копилке. */
export interface SavingRecord {
  id: string;
  goalId: string;
  /** Положительное – пополнение, отрицательное – снятие. */
  amount: number;
  period: number;
  at: number;
  /**
   * Трата, оплаченная прямо из копилки (например, внезапный осмотр
   * или исполненная мечта). Такие финкоины не проходят через баланс.
   */
  spentOn?: string;
  /** Перенос на другую цель: эта запись – списание, указана цель-получатель. */
  movedTo?: string;
  /** Перенос с другой цели: эта запись – зачисление. Это не новое пополнение. */
  movedFrom?: string;
}

/** Исполненная мечта: цель накоплена и «потрачена» на то, ради чего копили. */
export interface AchievedGoal {
  goalId: string;
  period: number;
  at: number;
}

/** Цель накопления. */
export interface Goal {
  id: string;
  title: string;
  price: number;
  /** Короткое пояснение «зачем», понятное ребёнку. */
  hint: string;
  icon: string;
  /** Цель придумана ребёнком. */
  custom?: boolean;
  /** На какой неделе ребёнок придумал цель – видно взрослому. */
  createdPeriod?: number;
}

/** Итог завершённой игровой недели. */
export interface PeriodSummary {
  period: number;
  income: number;
  plan: Allocation;
  fact: Allocation;
  /** Сколько очков развития принесла неделя и за что. */
  growthGained: number;
  growthReasons: { text: string; points: number; ok: boolean }[];
  statsBefore: PetStats;
  statsAfter: PetStats;
  stageBefore: Stage;
  stageAfter: Stage;
  questsDone: number;
  /** Короткая обратная связь и следующий шаг. */
  verdict: string;
  nextStep: string;
}

/** Результат выполнения задания. */
export interface QuestResult {
  questId: string;
  period: number;
  /** Насколько решение было удачным: 'good' | 'partial' | 'weak'. */
  grade: QuestGrade;
  reward: number;
  at: number;
}

export type QuestGrade = 'good' | 'partial' | 'weak';

/** Настройки доступности и режима работы. */
export interface Settings {
  animations: boolean;
  /** Демонстрационный режим: все задания открыты, недели переключаются сразу. */
  demoMode: boolean;
  /** Крупный текст. */
  largeText: boolean;
}

/** Состояние текущей игровой недели. */
export interface PeriodState {
  index: number;
  /** Сумма, доступная на неделю (доход недели + перенесённый остаток). */
  income: number;
  plan: Allocation | null;
  planConfirmed: boolean;
  /** Фактическое исполнение: сколько ушло по каждому направлению. */
  fact: Allocation;
  purchases: PurchaseRecord[];
  incomes: IncomeRecord[];
  savingsOps: SavingRecord[];
  questsDone: string[];
  /** Непредвиденное событие недели, если оно выпало. */
  eventId: string | null;
  eventResolved: boolean;
  /** Перенесённая с прошлой недели обязательная трата. */
  carriedEvent: { eventId: string; amount: number } | null;
}

/** Локальный игровой профиль – всё, что хранится на устройстве. */
export interface Profile {
  version: number;
  /** Игровое имя ребёнка (не настоящее имя). */
  playerName: string;
  pet: {
    species: SpeciesId;
    color: ColorId;
    name: string;
    stage: Stage;
    growth: number;
  };
  stats: PetStats;
  balance: number;
  goals: Goal[];
  /** Цели, на которые ребёнок копит сейчас, – не больше MAX_ACTIVE_GOALS. */
  activeGoalIds: string[];
  /** Накоплено по каждой цели. */
  savedByGoal: Record<string, number>;
  /** Исполненные мечты. */
  achievedGoals: AchievedGoal[];
  ownedItems: Record<string, number>;
  period: PeriodState;
  history: PeriodSummary[];
  questResults: QuestResult[];
  /** Сквозные журналы за всю игру – для истории и расчёта среднего пополнения. */
  incomeLog: IncomeRecord[];
  purchaseLog: PurchaseRecord[];
  savingsLog: SavingRecord[];
  /** Просмотренные термины справочника. */
  glossarySeen: string[];
  settings: Settings;
  /** Бонусы, начисленные взрослым. */
  parentBonuses: IncomeRecord[];
  createdAt: number;
  /** Профиль создан кнопкой «демонстрационный режим». */
  isTestProfile: boolean;
}
