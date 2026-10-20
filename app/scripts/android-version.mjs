/**
 * Версия Android-сборки.
 *
 * Папка android/ не хранится в репозитории: её создаёт Capacitor, и при создании
 * она получает версию 1.0 (сборка 1). Поэтому номер версии живёт в package.json,
 * а этот скрипт переносит его в build.gradle перед сборкой – чтобы у любого, кто
 * соберёт проект по инструкции, получился тот же номер, что указан в документации.
 *
 * Запуск: node scripts/android-version.mjs (в цепочке сборки релиза).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const GRADLE = path.resolve('android', 'app', 'build.gradle');
const PACKAGE = path.resolve('package.json');

async function main() {
  if (!existsSync(GRADLE)) throw new Error('Нет android-проекта. Сначала: npx cap add android');

  const pkg = JSON.parse(await readFile(PACKAGE, 'utf8'));
  const { versionName, versionCode } = pkg.android ?? {};
  if (!versionName || !versionCode) {
    throw new Error('В package.json нет поля "android": { "versionName", "versionCode" }');
  }

  const before = await readFile(GRADLE, 'utf8');
  const after = before
    .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
    .replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);

  if (after === before) {
    console.log(`Версия сборки уже ${versionName} (${versionCode})`);
    return;
  }

  await writeFile(GRADLE, after, 'utf8');
  console.log(`Версия сборки: ${versionName} (сборка ${versionCode})`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
