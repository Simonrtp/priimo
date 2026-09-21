/**
 * Export PDF paysage du rapport.
 *
 * pdf-lib : composition native (en-tête, pied, PDF importés, images),
 * sans navigateur, polices embarquables, A4 paysage fiable sur Vercel.
 * Aucune photo Street View : uniquement fichiers déposés.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import {
  construirePied,
  normaliserCouleurPrincipale,
  type IdentiteAgenceRapport,
  type IdentiteAgentRapport,
  type PiedBienRapport,
  type PiedRapport,
} from '@/lib/rapport/identite';
import { estDisposition } from '@/lib/rapport/modele';
import type { PageRapportComposee } from '@/lib/rapport/pages';
import { dessinerPageModele } from '@/lib/rapport/pdf-modele';
import { hexVersRgb, latin1 } from '@/lib/rapport/pdf-texte';
import { telechargerRapport } from '@/lib/rapport/storage';

export const PAGE_W = 841.89;
export const PAGE_H = 595.28;
const HEADER_H = 36;
const FOOTER_H = 42;
const MARGIN = 22;
const INK = rgb(0.08, 0.09, 0.11);
const MUTE = rgb(0.38, 0.4, 0.43);

function couleurAccent(hex: string) {
  const { r, g, b } = hexVersRgb(normaliserCouleurPrincipale(hex));
  return rgb(r / 255, g / 255, b / 255);
}

export type PageExport = PageRapportComposee;

export async function compterPagesPdf(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.getPageCount();
}

export async function genererPdfRapport(input: {
  agence: IdentiteAgenceRapport;
  agent: IdentiteAgentRapport;
  bien: PiedBienRapport;
  dateIso?: string | null;
  pages: PageExport[];
}): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const fontBold = await out.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await out.embedFont(StandardFonts.HelveticaOblique);
  const fontBoldItalic = await out.embedFont(StandardFonts.HelveticaBoldOblique);
  const logo = await embedLogo(out, input.agence.logoUrl);
  const accent = couleurAccent(input.agence.couleurPrincipale);
  const fonts = { regular: font, bold: fontBold, italic: fontItalic, boldItalic: fontBoldItalic };

  const total = Math.max(1, input.pages.length);
  if (input.pages.length === 0) {
    const page = out.addPage([PAGE_W, PAGE_H]);
    const pied = construirePied({
      agent: input.agent,
      bien: input.bien,
      dateIso: input.dateIso,
      page: 1,
      pages: 1,
    });
    dessinerGabarit(page, { font, fontBold, logo, pied, accent });
    return out.save();
  }

  let index = 0;
  for (const item of input.pages) {
    index += 1;
    const page = out.addPage([PAGE_W, PAGE_H]);
    const pied = construirePied({
      agent: input.agent,
      bien: input.bien,
      dateIso: input.dateIso,
      page: index,
      pages: total,
    });
    await dessinerContenu(out, page, item, {
      accentHex: normaliserCouleurPrincipale(input.agence.couleurPrincipale),
      fonts,
    });
    dessinerGabarit(page, { font, fontBold, logo, pied, accent });
  }

  return out.save();
}

async function embedLogo(
  doc: PDFDocument,
  logoUrl: string | null,
): Promise<{ width: number; height: number; draw: (page: PDFPage, x: number, y: number, h: number) => void } | null> {
  if (!logoUrl) return null;
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const mime = res.headers.get('content-type') ?? '';
    const img =
      mime.includes('png') || looksPng(bytes)
        ? await doc.embedPng(bytes)
        : await doc.embedJpg(bytes);
    return {
      width: img.width,
      height: img.height,
      draw(page, x, y, h) {
        const w = (img.width / img.height) * h;
        page.drawImage(img, { x, y, width: w, height: h });
      },
    };
  } catch {
    return null;
  }
}

function looksPng(bytes: Uint8Array): boolean {
  return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

function zoneContenu(): { x: number; y: number; w: number; h: number } {
  return {
    x: MARGIN,
    y: FOOTER_H,
    w: PAGE_W - MARGIN * 2,
    h: PAGE_H - HEADER_H - FOOTER_H,
  };
}

async function dessinerContenu(
  doc: PDFDocument,
  page: PDFPage,
  item: PageExport,
  ctx: {
    accentHex: string;
    fonts: {
      regular: PDFFont;
      bold: PDFFont;
      italic: PDFFont;
      boldItalic: PDFFont;
    };
  },
): Promise<void> {
  if (item.kind === 'modele' && item.disposition && estDisposition(item.disposition)) {
    const file = item.storagePath ? await telechargerRapport(item.storagePath) : null;
    await dessinerPageModele(doc, page, {
      disposition: item.disposition,
      contenu: item.contenu ?? {},
      accentHex: ctx.accentHex,
      fonts: ctx.fonts,
      zone: zoneContenu(),
      imageBytes: file?.bytes ?? null,
    });
    return;
  }
  if (!item.storagePath || item.kind === 'generee') return;
  const file = await telechargerRapport(item.storagePath);
  if (!file) return;
  const box = zoneContenu();

  if (item.kind === 'pdf' || file.contentType.includes('pdf')) {
    try {
      const src = await PDFDocument.load(file.bytes, { ignoreEncryption: true });
      const idx = Math.min(item.pageIndex, Math.max(0, src.getPageCount() - 1));
      const [embedded] = await doc.embedPages([src.getPage(idx)]);
      if (!embedded) return;
      const scale = Math.min(box.w / embedded.width, box.h / embedded.height);
      const w = embedded.width * scale;
      const h = embedded.height * scale;
      page.drawPage(embedded, {
        x: box.x + (box.w - w) / 2,
        y: box.y + (box.h - h) / 2,
        width: w,
        height: h,
      });
    } catch {
      return;
    }
    return;
  }

  try {
    const img = looksPng(file.bytes) ? await doc.embedPng(file.bytes) : await doc.embedJpg(file.bytes);
    const scale = Math.min(box.w / img.width, box.h / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    page.drawImage(img, {
      x: box.x + (box.w - w) / 2,
      y: box.y + (box.h - h) / 2,
      width: w,
      height: h,
    });
  } catch {
    return;
  }
}

function dessinerGabarit(
  page: PDFPage,
  ctx: {
    font: PDFFont;
    fontBold: PDFFont;
    logo: Awaited<ReturnType<typeof embedLogo>>;
    pied: PiedRapport;
    accent: ReturnType<typeof rgb>;
  },
) {
  page.drawRectangle({
    x: 0,
    y: PAGE_H - 3,
    width: PAGE_W,
    height: 3,
    color: ctx.accent,
  });

  if (ctx.logo) {
    ctx.logo.draw(page, MARGIN, PAGE_H - HEADER_H + 8, 20);
  }

  page.drawLine({
    start: { x: MARGIN, y: FOOTER_H - 2 },
    end: { x: PAGE_W - MARGIN, y: FOOTER_H - 2 },
    thickness: 0.6,
    color: rgb(0.86, 0.86, 0.87),
  });

  const baseline = 16;
  if (ctx.pied.agent) {
    page.drawText(latin1(ctx.pied.agent), {
      x: MARGIN,
      y: baseline + 10,
      size: 8,
      font: ctx.fontBold,
      color: INK,
    });
  }

  const droite = [ctx.pied.bien, ctx.pied.date, ctx.pied.page].filter((s): s is string => Boolean(s));
  let y = baseline + 10;
  for (const ligne of droite.reverse()) {
    const text = latin1(ligne);
    const w = ctx.font.widthOfTextAtSize(text, 8);
    page.drawText(text, {
      x: PAGE_W - MARGIN - w,
      y,
      size: 8,
      font: ctx.font,
      color: MUTE,
    });
    y -= 11;
  }
}

