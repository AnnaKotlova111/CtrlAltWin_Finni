/**
 * Добавляет в android-проект подпись релизной сборки.
 *
 * Папка `android` не хранится в репозитории: её заново создаёт
 * `npx cap add android`, и настройки подписи каждый раз пропадали бы.
 * Поэтому настройка не правится руками, а дописывается этим скриптом –
 * столько раз, сколько нужно: повторный запуск ничего не дублирует.
 *
 * Сами пароли лежат в `keystore.properties` в корне проекта. Этот файл
 * и файл ключа в репозиторий не попадают (см. `.gitignore`): по ТЗ 3.4
 * закрытых ключей в репозитории быть не должно.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gradle = join(root, 'android', 'app', 'build.gradle');

if (!existsSync(gradle)) {
  console.error('Не найден android/app/build.gradle. Сначала соберите отладочную версию.');
  process.exit(1);
}

let text = readFileSync(gradle, 'utf8');

if (text.includes('signingConfigs')) {
  console.log('Подпись релиза уже настроена');
  process.exit(0);
}

const signing = `    signingConfigs {
        release {
            def props = new Properties()
            def propsFile = rootProject.file('../../keystore.properties')
            if (propsFile.exists()) {
                propsFile.withInputStream { props.load(it) }
                storeFile file(props['storeFile'])
                storePassword props['storePassword']
                keyAlias props['keyAlias']
                keyPassword props['keyPassword']
            }
        }
    }
`;

// Блок подписи ставим перед buildTypes, а в самой релизной сборке на него ссылаемся.
text = text.replace('    buildTypes {', `${signing}    buildTypes {`);
text = text.replace(
  '        release {\n            minifyEnabled false',
  '        release {\n            signingConfig signingConfigs.release\n            minifyEnabled false'
);

writeFileSync(gradle, text, 'utf8');
console.log('Подпись релиза настроена');
