/**
 * Иконки приложения для Android.
 *
 * Берёт готовую иконку 512 × 512 из public/assets/ui и раскладывает её
 * по плотностям экрана, которые ждёт Android.
 *
 * Про адаптивную иконку. Android рисует её на поле 108 × 108 dp, а показывает
 * только центральные 72 × 72: остальное съедает форма значка (круг, скруглённый
 * квадрат, капля). Поэтому рисунок нужно класть так, чтобы он закрывал всё видимое
 * поле и чуть-чуть заходил за него, – иначе по краям останется фон и иконка
 * выглядит картинкой в рамке.
 *
 * Исходный файл нарисован с прозрачными полями по краям, поэтому сначала обрезаем
 * их, а потом вписываем рисунок ровно в видимую область – 72 из 108. Так картинка
 * занимает весь значок целиком и при этом ничего не теряет по краям.
 *
 * Запуск: npm run android:icons (после `npx cap add android`).
 */
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const SRC = path.resolve('public', 'assets', 'ui', 'app-icon-512.png');
const RES = path.resolve('android', 'app', 'src', 'main', 'res');

/** Плотность экрана -> сторона иконки в пикселях. */
const DENSITIES = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

/**
 * Доля поля адаптивной иконки, которую занимает рисунок: ровно видимая область.
 * Больше – начнёт срезать рожки и монетку, меньше – вокруг появится рамка фона.
 */
const FOREGROUND_SCALE = 72 / 108;

/**
 * Фон адаптивной иконки – средний цвет кромки рисунка. Его почти не видно:
 * рисунок закрывает всё поле. Нужен только на случай нестандартной формы значка,
 * поэтому он совпадает с цветом краёв картинки, а не спорит с ними.
 */
const BACKGROUND = '#8B4CDB';

/** Обрезает прозрачные поля исходника: дальше работаем с самим рисунком. */
async function trimmed() {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('Иконка пустая: не нашли непрозрачных точек');

  return sharp(SRC)
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .png()
    .toBuffer();
}

async function main() {
  if (!existsSync(SRC)) throw new Error(`Нет иконки ${SRC}`);
  if (!existsSync(RES)) throw new Error(`Нет android-проекта. Сначала: npx cap add android`);

  const art = await trimmed();

  for (const [density, size] of Object.entries(DENSITIES)) {
    const dir = path.join(RES, `mipmap-${density}`);

    // Обычная иконка: рисунок на всё поле, без полей по краям.
    const square = await sharp(art).resize(size, size, { fit: 'cover' }).png().toBuffer();
    await writeFile(path.join(dir, 'ic_launcher.png'), square);

    // Круглая иконка: та же картинка, обрезанная кругом.
    const circle = Buffer.from(
      `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
    );
    await sharp(square)
      .composite([{ input: circle, blend: 'dest-in' }])
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));

    // Передний план адаптивной иконки: рисунок закрывает всё видимое поле.
    const inner = Math.round(size * FOREGROUND_SCALE);
    await sharp({
      create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([
        { input: await sharp(art).resize(inner, inner, { fit: 'cover' }).png().toBuffer(), gravity: 'center' },
      ])
      .png()
      .toFile(path.join(dir, 'ic_launcher_foreground.png'));
  }

  // Цвет фона адаптивной иконки.
  await writeFile(
    path.join(RES, 'values', 'ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BACKGROUND}</color>\n</resources>\n`,
    'utf8'
  );

  console.log(`Иконки Android: ${Object.keys(DENSITIES).length} плотностей × 3 файла`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
