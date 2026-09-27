/**
 * Корневой компонент: навигация между экранами.
 *
 * Навигация нарочно простая – стек экранов. Кнопка «назад» всегда
 * в одном и том же месте, нижняя панель доступна из любого раздела.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { FeedbackSheet } from './components/FeedbackSheet';
import { Icon, type IconName } from './components/Icon';
import { closeTopOverlay } from './state/overlays';
import { useStore } from './state/store';

import { AdultScreen } from './screens/AdultScreen';
import { BudgetScreen } from './screens/BudgetScreen';
import { GlossaryScreen } from './screens/GlossaryScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { HomeScreen } from './screens/HomeScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { QuestScreen } from './screens/QuestScreen';
import { QuestsScreen } from './screens/QuestsScreen';
import { SavingsScreen } from './screens/SavingsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ShopScreen } from './screens/ShopScreen';

export type Route =
  | { name: 'home' }
  | { name: 'budget' }
  | { name: 'shop' }
  | { name: 'savings' }
  | { name: 'quests' }
  | { name: 'quest'; id: string }
  | { name: 'progress' }
  | { name: 'glossary' }
  | { name: 'history' }
  | { name: 'adult' }
  | { name: 'settings' };

export interface Nav {
  go: (route: Route) => void;
  back: () => void;
  reset: (route: Route) => void;
  canGoBack: boolean;
  /**
   * Обработчик для кнопки «Назад» в шапке. Есть только когда возвращаться
   * действительно есть куда: раздел, открытый с нижней панели, – первый
   * экран стека, и мёртвая стрелка в нём только путает.
   */
  onBack?: () => void;
}

const TABS: { route: Route['name']; label: string; icon: IconName }[] = [
  { route: 'home', label: 'Главная', icon: 'home' },
  { route: 'budget', label: 'Бюджет', icon: 'budget' },
  { route: 'shop', label: 'Покупки', icon: 'shop' },
  { route: 'savings', label: 'Копилка', icon: 'piggy' },
  { route: 'quests', label: 'Задания', icon: 'quests' },
];

export default function App() {
  const { profile, ready } = useStore();
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const route = stack[stack.length - 1];

  /*
   * Новый профиль – всегда главный экран. Профиль удаляют и сбрасывают
   * из раздела для взрослого, и без этого игра после знакомства открывалась
   * бы на том экране, с которого её сбросили.
   */
  const createdAt = profile?.createdAt ?? null;
  const lastCreated = useRef<number | null>(null);
  useEffect(() => {
    if (createdAt !== null && lastCreated.current !== createdAt) {
      lastCreated.current = createdAt;
      setStack([{ name: 'home' }]);
    }
  }, [createdAt]);

  const nav = useMemo<Nav>(() => {
    const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    return {
      go: (r) => setStack((s) => [...s, r]),
      back,
      reset: (r) => setStack([r]),
      canGoBack: stack.length > 1,
      onBack: stack.length > 1 ? back : undefined,
    };
  }, [stack.length]);

  /*
   * Системная кнопка «назад». Порядок такой: сначала закрывается открытое
   * окно, потом экран возвращается на предыдущий, и только с первого экрана
   * игра закрывается.
   *
   * В браузере кнопку даёт история страницы, в приложении – Capacitor:
   * сам по себе он системную кнопку не обрабатывает и просто закрывает
   * приложение, поэтому нужен плагин `@capacitor/app`. Пока на событие
   * никто не подписан, плагин ведёт себя по-старому – поэтому подписка
   * и делает всю работу.
   */
  const depth = useRef(stack.length);
  depth.current = stack.length;

  useEffect(() => {
    const goBack = () => {
      if (closeTopOverlay()) return true;
      if (depth.current > 1) {
        setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
        return true;
      }
      return false;
    };

    const onPop = () => {
      goBack();
      history.pushState(null, '');
    };
    history.pushState(null, '');
    window.addEventListener('popstate', onPop);

    let removeNative: (() => void) | undefined;
    let cancelled = false;
    // Импорт ленивый: в браузере плагина нет, и падать из-за этого нельзя.
    import('@capacitor/app')
      .then(({ App: NativeApp }) =>
        NativeApp.addListener('backButton', () => {
          if (!goBack()) NativeApp.exitApp();
        })
      )
      .then((handle) => {
        if (cancelled) handle.remove();
        else removeNative = () => handle.remove();
      })
      .catch(() => {
        /* в браузере работаем через историю страницы */
      });

    return () => {
      cancelled = true;
      window.removeEventListener('popstate', onPop);
      removeNative?.();
    };
  }, []);

  // Настройки доступности применяются к корню документа.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.large = String(profile?.settings.largeText ?? false);
    root.dataset.anim = String(profile?.settings.animations ?? true);
  }, [profile?.settings.largeText, profile?.settings.animations]);

  const goTab = useCallback((name: Route['name']) => setStack([{ name } as Route]), []);

  if (!ready) {
    return (
      <div className="app">
        <div className="splash">
          <img src="./icon-192.png" alt="" width={96} height={96} />
          <p className="muted">Загружаем профиль…</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="app">
        <OnboardingScreen />
        <FeedbackSheet />
      </div>
    );
  }

  return (
    <div className="app">
      {route.name === 'home' && <HomeScreen nav={nav} />}
      {route.name === 'budget' && <BudgetScreen nav={nav} />}
      {route.name === 'shop' && <ShopScreen nav={nav} />}
      {route.name === 'savings' && <SavingsScreen nav={nav} />}
      {route.name === 'quests' && <QuestsScreen nav={nav} />}
      {route.name === 'quest' && <QuestScreen nav={nav} questId={route.id} />}
      {route.name === 'progress' && <ProgressScreen nav={nav} />}
      {route.name === 'glossary' && <GlossaryScreen nav={nav} />}
      {route.name === 'history' && <HistoryScreen nav={nav} />}
      {route.name === 'adult' && <AdultScreen nav={nav} />}
      {route.name === 'settings' && <SettingsScreen nav={nav} />}

      <nav className="tabbar" aria-label="Разделы">
        {TABS.map((t) => (
          <button
            key={t.route}
            className="tab"
            aria-current={route.name === t.route ? 'page' : undefined}
            onClick={() => goTab(t.route)}
          >
            <Icon name={t.icon} size={28} />
            {t.label}
          </button>
        ))}
      </nav>

      <FeedbackSheet />
    </div>
  );
}
