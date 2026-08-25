/**
 * Génère le jeu d'icônes de la PWA depuis la marque Priimo.
 *
 * Deux familles distinctes, exigées par la spec Web App Manifest :
 *  - « any »      : la marque telle quelle, fond transparent, affichée sans
 *                   retouche par le navigateur.
 *  - « maskable » : Android recadre l'icône en cercle ou en squircle. Le glyphe
 *                   doit donc tenir dans la zone sûre (80 % du côté) sur un fond
 *                   plein, sinon les bords sont rognés.
 *
 * À relancer uniquement si le logo change : `node scripts/generate-pwa-icons.mjs`.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SOURCE = path.join('public', 'faviconpriimo.png');
const OUT_DIR = path.join('public', 'icons');

/** Crème de la charte : fond des icônes masquables. */
const BACKGROUND = { r: 0xff, g: 0xf7, b: 0xf0, alpha: 1 };

/** Part du côté occupée par le glyphe sur une icône masquable (zone sûre). */
const SAFE_ZONE_RATIO = 0.62;

async function buildAny(size) {
  return sharp(SOURCE)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function buildMaskable(size) {
  const glyphSize = Math.round(size * SAFE_ZONE_RATIO);
  const glyph = await sharp(SOURCE)
    .resize(glyphSize, glyphSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  return sharp({
    create: { width: size, height: size, channels: 4, background: BACKGROUND },
  })
    .composite([{ input: glyph, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const targets = [
    ['icon-192.png', () => buildAny(192)],
    ['icon-512.png', () => buildAny(512)],
    ['maskable-192.png', () => buildMaskable(192)],
    ['maskable-512.png', () => buildMaskable(512)],
  ];

  for (const [name, build] of targets) {
    const buffer = await build();
    await sharp(buffer).toFile(path.join(OUT_DIR, name));
    console.log(`${name} — ${(buffer.byteLength / 1024).toFixed(1)} Ko`);
  }
}

await main();
