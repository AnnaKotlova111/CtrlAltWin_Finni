/**
 * Точка входа.
 *
 * Шрифты подключаются локально (пакеты @fontsource, лицензия OFL) –
 * приложение работает без интернета.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Заголовки – Nunito ExtraBold (в дизайн-коде это первый из двух вариантов;
// Baloo 2 не подошёл, потому что не содержит кириллицы).
import '@fontsource/nunito/cyrillic-700.css';
import '@fontsource/nunito/cyrillic-800.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
// Основной текст и финансовые цифры – Nunito Sans.
import '@fontsource/nunito-sans/cyrillic-400.css';
import '@fontsource/nunito-sans/cyrillic-600.css';
import '@fontsource/nunito-sans/cyrillic-700.css';
import '@fontsource/nunito-sans/latin-400.css';
import '@fontsource/nunito-sans/latin-600.css';
import '@fontsource/nunito-sans/latin-700.css';

import './styles/tokens.css';
import './styles/app.css';
import './styles/components.css';

import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StoreProvider } from './state/store';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <StoreProvider>
        <App />
      </StoreProvider>
    </ErrorBoundary>
  </StrictMode>
);
