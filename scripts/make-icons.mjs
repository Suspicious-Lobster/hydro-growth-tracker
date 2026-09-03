// Rasterises assets/icon.svg into the real application icon set used by
// electron-builder (and by main.js for the Linux/dev window icon):
//   assets/icons/icon.png     - 1024x1024 PNG (Linux + source for the rest)
//   assets/icons/icon-512.png - 512x512 PNG (smaller Linux/AppImage variant)
//   assets/icons/icon.ico     - Windows icon, 16..256px frames
//   assets/icons/icon.icns    - macOS icon
//
// Idempotent: re-running just regenerates the same files from the same
// source SVG.
import { readFile, writeFile, mkdir, stat } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import png2icons from 'png2icons';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

const svgPath = path.join(root, 'assets', 'icon.svg');
const iconsDir = path.join(root, 'assets', 'icons');

async function report(label, filePath) {
  const { size } = await stat(filePath);
  console.log(`${label}: ${filePath} (${size} bytes)`);
}

async function main() {
  await mkdir(iconsDir, { recursive: true });

  const svgBuffer = await readFile(svgPath);

  // 1024x1024 master PNG.
  const png1024 = await sharp(svgBuffer, { density: 384 })
    .resize(1024, 1024)
    .png()
    .toBuffer();
  const pngPath = path.join(iconsDir, 'icon.png');
  await writeFile(pngPath, png1024);
  await report('icon.png (1024x1024)', pngPath);

  // 512x512 PNG for smaller Linux targets.
  const png512 = await sharp(svgBuffer, { density: 192 })
    .resize(512, 512)
    .png()
    .toBuffer();
  const png512Path = path.join(iconsDir, 'icon-512.png');
  await writeFile(png512Path, png512);
  await report('icon-512.png (512x512)', png512Path);

  // Windows .ico, 16..256px frames. PNG=false uses BMP-encoded frames
  // (larger, uncompressed, universally supported by Explorer/taskbar).
  const icoBuffer = png2icons.createICO(png1024, png2icons.BICUBIC2, 0, false, true);
  if (!icoBuffer) {
    throw new Error('png2icons.createICO returned null');
  }
  const icoPath = path.join(iconsDir, 'icon.ico');
  await writeFile(icoPath, icoBuffer);
  await report('icon.ico', icoPath);

  // macOS .icns.
  const icnsBuffer = png2icons.createICNS(png1024, png2icons.BICUBIC2, 0);
  if (!icnsBuffer) {
    throw new Error('png2icons.createICNS returned null');
  }
  const icnsPath = path.join(iconsDir, 'icon.icns');
  await writeFile(icnsPath, icnsBuffer);
  await report('icon.icns', icnsPath);

  console.log('Icon generation complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
