/**
 * Убирает из манифеста разрешение INTERNET.
 *
 * Capacitor прописывает его по умолчанию, но приложение ни одного сетевого
 * запроса не делает: веб-часть лежит в самой сборке и открывается локально.
 * ТЗ 3.4 требует запрашивать только необходимые разрешения, поэтому лишнее
 * убираем. Папка `android` пересоздаётся, поэтому правка не ручная, а скриптом:
 * повторный запуск ничего не ломает.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

if (!existsSync(manifest)) {
  console.error('Не найден AndroidManifest.xml');
  process.exit(1);
}

const text = readFileSync(manifest, 'utf8');
const cleaned = text.replace(
  /^[ \t]*<uses-permission[^>]*android\.permission\.INTERNET[^>]*\/>\r?\n?/gm,
  ''
);

if (cleaned === text) {
  console.log('Разрешений в манифесте нет');
} else {
  writeFileSync(manifest, cleaned, 'utf8');
  console.log('Разрешение INTERNET убрано из манифеста');
}
