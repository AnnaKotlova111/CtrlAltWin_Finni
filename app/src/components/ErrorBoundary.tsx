/**
 * Страховка от белого экрана.
 *
 * Если где-то возникнет непредвиденная ошибка, ребёнок увидит понятный экран
 * с кнопкой перезапуска, а не пустоту. Прогресс при этом не теряется:
 * профиль уже сохранён в локальном хранилище.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Никаких внешних сервисов: ошибка остаётся на устройстве.
    console.error('Непредвиденная ошибка:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="app">
        <div className="splash">
          <img src="./icon-192.png" alt="" width={96} height={96} />
          <h2>Что-то пошло не так</h2>
          <p className="muted center" style={{ maxWidth: 300 }}>
            Твой прогресс сохранён. Нажми кнопку – и мы вернёмся к питомцу
          </p>
          <button className="btn" style={{ maxWidth: 260 }} onClick={() => location.reload()}>
            Вернуться в игру
          </button>
        </div>
      </div>
    );
  }
}
