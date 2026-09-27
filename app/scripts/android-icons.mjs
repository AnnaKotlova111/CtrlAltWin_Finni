/**
 * Иконки приложения для Android.
 *
 * Берёт готовую иконку 512 × 512 из public/assets/ui и раскладывает её
 * по плотностям экрана, которые ждёт Android. Отдельно готовит слой
 * переднего плана для адаптивной иконки: там рисунок занимает центральные
 * две трети, потому что систему обрезает края под форму значка.
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

/** Фон адаптивной иконки – кремовый из дизайн-кода. */
const BACKGROUND = '#FFF9F0';

async function main() {
  if (!existsSync(SRC)) throw new Error(`Нет иконки ${SRC}`);
  if (!existsSync(RES)) throw new Error(`Нет android-проекта. Сначала: npx cap add android`);

  const square = await sharp(SRC).resize(512, 512, { fit: 'contain', background: BACKGROUND }).png().toBuffer();

  for (const [density, size] of Object.entries(DENSITIES)) {
    const dir = path.join(RES, `mipmap-${density}`);

    await sharp(square).resize(size, size).png().toFile(path.join(dir, 'ic_launcher.png'));

    // Круглая иконка: та же картинка, обрезанная кругом.
    const circle = Buffer.from(
      `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
    );
    await sharp(square)
      .resize(size, size)
      .composite([{ input: circle, blend: 'dest-in' }])
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));

    // Передний план адаптивной иконки: рисунок в центре, вокруг прозрачные поля.
    const inner = Math.round(size * 0.62);
    await sharp({
      create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: await sharp(square).resize(inner, inner).png().toBuffer(), gravity: 'center' }])
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
