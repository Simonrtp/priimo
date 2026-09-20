import { rgb, type PDFDocument, type PDFFont, type PDFPage, type PDFImage } from 'pdf-lib';
import { visuelPage, type ContenuPageModele } from '@/lib/rapport/modele';
import { couperLignes, hexVersRgb, latin1 } from '@/lib/rapport/pdf-texte';
import type { DispositionPageAgence } from '@/types/database';

const INK = rgb(0.08, 0.09, 0.11);
const MUTE = rgb(0.38, 0.4, 0.43);

export type ZonePage = { x: number; y: number; w: number; h: number };

type Fonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont; boldItalic: PDFFont };

function accentRgb(hex: string) {
  const { r, g, b } = hexVersRgb(hex);
  return rgb(r / 255, g / 255, b / 255);
}

function largeur(font: PDFFont, size: number) {
  return (s: string) => font.widthOfTextAtSize(latin1(s), size);
}

function dessinerTitre(
  page: PDFPage,
  titre: string,
  fonts: Fonts,
  accent: ReturnType<typeof rgb>,
  x: number,
  top: number,
  maxW: number,
): number {
  const size = 18;
  const lines = couperLignes(titre, largeur(fonts.bold, size), maxW);
  let y = top;
  for (const line of lines.slice(0, 3)) {
    page.drawText(latin1(line), { x, y: y - size, size, font: fonts.bold, color: INK });
    y -= size + 4;
  }
  page.drawRectangle({ x, y: y - 6, width: Math.min(56, maxW), height: 3, color: accent });
  return y - 18;
}

function fontPour(fonts: Fonts, gras: boolean, italique: boolean): PDFFont {
  if (gras && italique) return fonts.boldItalic;
  if (gras) return fonts.bold;
  if (italique) return fonts.italic;
  return fonts.regular;
}

function dessinerCorps(
  page: PDFPage,
  corps: ContenuPageModele['corps'],
  fonts: Fonts,
  x: number,
  top: number,
  maxW: number,
  maxBottom: number,
): number {
  if (!corps) return top;
  const size = 10.5;
  const lineH = 14;
  let y = top;
  for (const bloc of corps) {
    if (y < maxBottom + lineH) break;
    if (bloc.type === 'ul') {
      for (const item of bloc.items) {
        if (y < maxBottom + lineH) break;
        page.drawCircle({ x: x + 3, y: y - 7, size: 1.6, color: INK });
        y = dessinerRuns(page, item, fonts, x + 12, y, maxW - 12, maxBottom, size, lineH);
        y -= 4;
      }
      y -= 4;
      continue;
    }
    y = dessinerRuns(page, bloc.runs, fonts, x, y, maxW, maxBottom, size, lineH);
    y -= 8;
  }
  return y;
}

function dessinerRuns(
  page: PDFPage,
  runs: { text: string; gras?: boolean; italique?: boolean }[],
  fonts: Fonts,
  x: number,
  top: number,
  maxW: number,
  maxBottom: number,
  size: number,
  lineH: number,
): number {
  let y = top;
  let cursor = 0;
  const flushLine = (segments: { text: string; font: PDFFont }[]) => {
    if (y < maxBottom + lineH) return;
    let cx = x;
    for (const seg of segments) {
      const t = latin1(seg.text);
      if (!t) continue;
      page.drawText(t, { x: cx, y: y - size, size, font: seg.font, color: INK });
      cx += seg.font.widthOfTextAtSize(t, size);
    }
    y -= lineH;
    cursor = 0;
  };

  let line: { text: string; font: PDFFont }[] = [];
  for (const run of runs) {
    const font = fontPour(fonts, run.gras === true, run.italique === true);
    const words = latin1(run.text).replace(/\s+/g, ' ').split(' ');
    for (let i = 0; i < words.length; i += 1) {
      const word = words[i]!;
      if (!word && i === 0) continue;
      const piece = (cursor > 0 || line.length > 0) && word ? ` ${word}` : word;
      const w = font.widthOfTextAtSize(piece, size);
      if (cursor + w > maxW && (cursor > 0 || line.length > 0)) {
        flushLine(line);
        line = [];
        cursor = 0;
        const solo = word;
        const sw = font.widthOfTextAtSize(solo, size);
        line.push({ text: solo, font });
        cursor = sw;
      } else {
        line.push({ text: piece, font });
        cursor += w;
      }
    }
  }
  if (line.length > 0) flushLine(line);
  return y;
}

function dessinerImage(
  page: PDFPage,
  img: PDFImage,
  box: { x: number; y: number; w: number; h: number },
  cover: boolean,
) {
  const scale = cover
    ? Math.max(box.w / img.width, box.h / img.height)
    : Math.min(box.w / img.width, box.h / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const x = box.x + (box.w - w) / 2;
  const y = box.y + (box.h - h) / 2;
  page.drawImage(img, { x, y, width: w, height: h });
}

export async function dessinerPageModele(
  doc: PDFDocument,
  page: PDFPage,
  input: {
    disposition: DispositionPageAgence;
    contenu: ContenuPageModele;
    accentHex: string;
    fonts: Fonts;
    zone: ZonePage;
    imageBytes?: Uint8Array | null;
  },
): Promise<void> {
  const visuel = visuelPage(input.contenu);
  const accent = accentRgb(input.accentHex);
  const { zone, fonts } = input;
  const img = input.imageBytes ? await embedImage(doc, input.imageBytes) : null;

  if (input.disposition === 'image') {
    if (img) {
      dessinerImage(page, img, zone, true);
    }
    if (visuel.titre) {
      const pad = 14;
      page.drawRectangle({
        x: zone.x,
        y: zone.y + zone.h - 44,
        width: zone.w,
        height: 44,
        color: rgb(1, 1, 1),
        opacity: 0.88,
      });
      dessinerTitre(page, visuel.titre, fonts, accent, zone.x + pad, zone.y + zone.h - 8, zone.w - pad * 2);
    }
    return;
  }

  let cursor = zone.y + zone.h - 4;
  const bottom = zone.y + 4;

  if (input.disposition === 'texte') {
    if (visuel.titre) cursor = dessinerTitre(page, visuel.titre, fonts, accent, zone.x, cursor, zone.w);
    dessinerCorps(page, visuel.corps, fonts, zone.x, cursor, zone.w, bottom);
    return;
  }

  if (input.disposition === 'texte_image') {
    const gap = 22;
    const colW = (zone.w - gap) / 2;
    const imageAGauche = visuel.imageCote === 'gauche';
    const hasImage = Boolean(img);
    const hasText = Boolean(visuel.titre) || visuel.corps.length > 0;
    if (hasImage && hasText) {
      const textX = imageAGauche ? zone.x + colW + gap : zone.x;
      const imgX = imageAGauche ? zone.x : zone.x + colW + gap;
      if (visuel.titre) cursor = dessinerTitre(page, visuel.titre, fonts, accent, textX, cursor, colW);
      dessinerCorps(page, visuel.corps, fonts, textX, cursor, colW, bottom);
      dessinerImage(page, img!, { x: imgX, y: zone.y + 8, w: colW, h: zone.h - 16 }, false);
    } else if (hasImage) {
      dessinerImage(page, img!, { x: zone.x, y: zone.y + 8, w: zone.w, h: zone.h - 16 }, false);
    } else {
      if (visuel.titre) cursor = dessinerTitre(page, visuel.titre, fonts, accent, zone.x, cursor, zone.w);
      dessinerCorps(page, visuel.corps, fonts, zone.x, cursor, zone.w, bottom);
    }
    return;
  }

  if (visuel.titre) cursor = dessinerTitre(page, visuel.titre, fonts, accent, zone.x, cursor, zone.w);
  if (visuel.points.length === 0) return;

  const cols = visuel.points.length <= 3 ? visuel.points.length : 2;
  const rows = Math.ceil(visuel.points.length / cols);
  const gapX = 16;
  const gapY = 14;
  const cellW = (zone.w - gapX * (cols - 1)) / cols;
  const available = cursor - bottom;
  const cellH = (available - gapY * (rows - 1)) / rows;

  visuel.points.forEach((point, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = zone.x + col * (cellW + gapX);
    const top = cursor - row * (cellH + gapY);
    page.drawRectangle({ x, y: top - cellH, width: 3, height: cellH - 4, color: accent });
    let y = top - 4;
    if (point.intitule) {
      const lines = couperLignes(point.intitule, largeur(fonts.bold, 11), cellW - 16);
      for (const line of lines.slice(0, 2)) {
        page.drawText(latin1(line), { x: x + 12, y: y - 11, size: 11, font: fonts.bold, color: INK });
        y -= 14;
      }
    }
    if (point.description) {
      const lines = couperLignes(point.description, largeur(fonts.regular, 9.5), cellW - 16);
      for (const line of lines.slice(0, 3)) {
        page.drawText(latin1(line), { x: x + 12, y: y - 10, size: 9.5, font: fonts.regular, color: MUTE });
        y -= 13;
      }
    }
  });
}

async function embedImage(doc: PDFDocument, bytes: Uint8Array): Promise<PDFImage | null> {
  try {
    const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    return png ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  } catch {
    return null;
  }
}
