import { rgb, type PDFFont, type PDFPage, type PDFDocument } from 'pdf-lib';
import type { KindGeneree } from '@/lib/rapport/modele-defaut';
import { formatDateRapport, joindreSansVide } from '@/lib/rapport/identite';
import { hexVersRgb, latin1, couperLignes } from '@/lib/rapport/pdf-texte';
import { ATTRIBUTION_IGN, urlCarteIgn } from '@/lib/rapport/genere/carte-ign';
import type { DossierRapport } from '@/lib/rapport/genere/types';
import {
  formatDistance,
  formatEuro,
  formatPrixM2,
  formatSurface,
  intituleBien,
  libelleAscenseur,
  libelleEtageAffiche,
  libelleOccupation,
  libelleTypeLocal,
} from '@/lib/rapport/genere/format';
import { formatDateCourte } from '@/lib/rapport/genere/format';

type Fonts = { regular: PDFFont; bold: PDFFont };

export async function dessinerPageGeneree(
  doc: PDFDocument,
  page: PDFPage,
  kind: KindGeneree,
  dossier: DossierRapport,
  zone: { x: number; y: number; w: number; h: number },
  fonts: Fonts,
  accentHex: string,
  pleinPage: boolean,
): Promise<void> {
  const ink = rgb(0.08, 0.09, 0.11);
  const mute = rgb(0.38, 0.4, 0.43);
  const { r, g, b } = hexVersRgb(accentHex);
  const accent = rgb(r / 255, g / 255, b / 255);
  const ctx = { page, fonts, ink, mute, accent, zone: pleinPage ? { x: 28, y: 28, w: 786, h: 540 } : zone };

  if (kind === 'couverture') {
    await couverture(doc, ctx, dossier);
    return;
  }
  titre(ctx, libelle(kind));
  const y0 = ctx.zone.y + ctx.zone.h - 36;
  switch (kind) {
    case 'votre_bien':
      lignes(ctx, y0, [
        intituleBien(dossier),
        dossier.adresse,
        dossier.surfaceM2 != null ? `Surface ${formatSurface(dossier.surfaceM2)}` : null,
        dossier.client.nom ? `À la demande de ${dossier.client.nom}` : null,
        joindreSansVide([dossier.agence.nomCommercial, dossier.agence.telephone, dossier.agence.email]),
        joindreSansVide([dossier.agent.nom, dossier.agent.telephone, dossier.agent.email]),
      ]);
      break;
    case 'description':
      if (dossier.dpeClass) texte(ctx, ctx.zone.x + ctx.zone.w - 40, y0, `DPE ${dossier.dpeClass}`, 12, true);
      if (dossier.commentairesPublics) paragraphe(ctx, y0 - 8, dossier.commentairesPublics);
      break;
    case 'immeuble_appartement':
      lignes(ctx, y0, [
        libelleEtageAffiche(dossier.floor),
        libelleAscenseur(dossier.ascenseur),
        dossier.rooms != null ? `${dossier.rooms} pièces` : null,
        dossier.surfaceM2 != null ? `Habitable ${formatSurface(dossier.surfaceM2)}` : null,
        dossier.surfaceCarrez != null ? `Carrez ${formatSurface(dossier.surfaceCarrez)}` : null,
        libelleOccupation(dossier.occupation),
      ]);
      break;
    case 'secteur':
      if (dossier.iris) {
        lignes(ctx, y0, [
          dossier.iris.commune,
          dossier.iris.partAppartements != null ? `${dossier.iris.partAppartements} % d'appartements` : null,
          dossier.iris.epoque,
        ]);
      }
      if (dossier.latitude != null && dossier.longitude != null) {
        await carte(doc, ctx, dossier.latitude, dossier.longitude, ctx.zone.x + ctx.zone.w / 2, ctx.zone.y + 20);
      }
      break;
    case 'points_interet':
      lignes(
        ctx,
        y0,
        dossier.equipements.slice(0, 12).map((e) => `${e.nom} — ${formatDistance(e.distanceM)}`),
      );
      break;
    case 'connectivite':
      lignes(ctx, y0, [
        ...dossier.fixe.map((l) => `${l.operateur} ${l.technologie} ${l.eligible ? 'éligible' : 'non éligible'}`),
        ...dossier.mobile.map((l) => `${l.operateur} ${l.generation} ${l.niveau}`),
      ]);
      break;
    case 'permis':
      lignes(
        ctx,
        y0,
        dossier.permis.map((p, i) => `${i + 1}. ${p.numero}${p.type ? ` · ${p.type}` : ''}`),
      );
      break;
    case 'comparables':
      lignes(
        ctx,
        y0,
        dossier.comparables.map(
          (v) =>
            `${joindreSansVide([libelleTypeLocal(v.typeLocal), formatSurface(v.surfaceM2), formatEuro(v.prix), v.prixM2 != null ? formatPrixM2(v.prixM2) : null, formatDateCourte(v.date)])}`,
        ),
      );
      break;
    case 'concurrentiel':
      lignes(ctx, y0, [
        `${dossier.annonces.length} annonce${dossier.annonces.length > 1 ? 's' : ''} active${dossier.annonces.length > 1 ? 's' : ''}`,
        dossier.fluiditeJoursMedian != null
          ? `Delai median ${Math.round(dossier.fluiditeJoursMedian)} jours`
          : null,
        dossier.negotiationPctMedian != null
          ? `Negociation mediane ${dossier.negotiationPctMedian.toFixed(1)} %`
          : null,
        ...dossier.annonces.slice(0, 8).map((a) =>
          joindreSansVide([
            libelleTypeLocal(a.typeLocal),
            a.surfaceM2 != null ? formatSurface(a.surfaceM2) : null,
            a.prix != null ? formatEuro(a.prix) : null,
            formatDateCourte(a.dateReleve),
          ]),
        ),
      ]);
      break;
    case 'indices':
      lignes(ctx, y0, [
        dossier.oat.length > 0 ? `OAT ${dossier.oat[dossier.oat.length - 1]!.taux} %` : null,
        dossier.effort?.secteur != null ? `Effort d'achat ${dossier.effort.secteur} années` : null,
        dossier.fluiditeJoursMedian != null ? `Délai médian ${Math.round(dossier.fluiditeJoursMedian)} jours` : null,
      ]);
      break;
    case 'prix':
      if (dossier.priceValue != null) texte(ctx, ctx.zone.x, y0 - 10, formatEuro(dossier.priceValue), 28, true);
      lignes(ctx, y0 - 50, [
        dossier.pricePerM2 != null && dossier.surfacePrixLibelle
          ? `${formatPrixM2(dossier.pricePerM2)} (${dossier.surfacePrixLibelle})`
          : null,
        dossier.priceLow != null && dossier.priceHigh != null
          ? `${formatEuro(dossier.priceLow)} – ${formatEuro(dossier.priceHigh)}`
          : null,
        libelleOccupation(dossier.occupation),
        dossier.remarquesExpert,
      ]);
      break;
    case 'prochaine_etape':
      paragraphe(ctx, y0, dossier.ctaProchaineEtape);
      lignes(ctx, y0 - 80, [
        joindreSansVide([dossier.agent.nom, dossier.agent.telephone, dossier.agent.email]),
        joindreSansVide([dossier.agence.nomCommercial, dossier.agence.telephone, dossier.agence.email]),
      ]);
      break;
  }
}

function libelle(kind: KindGeneree): string {
  const map: Record<KindGeneree, string> = {
    couverture: '',
    votre_bien: 'Votre bien',
    description: 'Description du bien',
    immeuble_appartement: "L'immeuble et l'appartement",
    secteur: 'Le secteur',
    points_interet: "Points d'interet",
    connectivite: 'Connectivite',
    permis: 'Permis de construire',
    comparables: 'Ventes comparables',
    concurrentiel: 'Etude concurrentielle',
    indices: 'Indices du marche',
    prix: 'Notre estimation',
    prochaine_etape: 'Prochaine etape',
  };
  return map[kind];
}

type Ctx = {
  page: PDFPage;
  fonts: Fonts;
  ink: ReturnType<typeof rgb>;
  mute: ReturnType<typeof rgb>;
  accent: ReturnType<typeof rgb>;
  zone: { x: number; y: number; w: number; h: number };
};

function titre(ctx: Ctx, t: string) {
  if (!t) return;
  ctx.page.drawText(latin1(t), {
    x: ctx.zone.x,
    y: ctx.zone.y + ctx.zone.h - 18,
    size: 16,
    font: ctx.fonts.bold,
    color: ctx.accent,
  });
}

function texte(ctx: Ctx, x: number, y: number, t: string, size: number, bold = false) {
  ctx.page.drawText(latin1(t), {
    x,
    y,
    size,
    font: bold ? ctx.fonts.bold : ctx.fonts.regular,
    color: ctx.ink,
  });
}

function lignes(ctx: Ctx, yStart: number, items: Array<string | null | undefined>) {
  let y = yStart;
  for (const item of items) {
    if (!item?.trim()) continue;
    ctx.page.drawText(latin1(item), {
      x: ctx.zone.x,
      y,
      size: 10,
      font: ctx.fonts.regular,
      color: ctx.ink,
    });
    y -= 16;
  }
}

function paragraphe(ctx: Ctx, yStart: number, raw: string) {
  const lines = couperLignes(raw, (s) => ctx.fonts.regular.widthOfTextAtSize(s, 10), ctx.zone.w);
  let y = yStart;
  for (const line of lines.slice(0, 18)) {
    ctx.page.drawText(line, { x: ctx.zone.x, y, size: 10, font: ctx.fonts.regular, color: ctx.ink });
    y -= 14;
  }
}

async function couverture(doc: PDFDocument, ctx: Ctx, d: DossierRapport) {
  ctx.page.drawRectangle({
    x: 0,
    y: 592,
    width: 842,
    height: 4,
    color: ctx.accent,
  });
  if (d.photoCouverture) {
    try {
      const img = await embedRemote(doc, d.photoCouverture.url);
      if (img) ctx.page.drawImage(img.img, { x: 0, y: 250, width: 842, height: 345 });
    } catch {
      /* photo optionnelle */
    }
  }
  let y = d.photoCouverture ? 210 : 360;
  ctx.page.drawText(latin1(d.titreCouverture), {
    x: 48,
    y,
    size: 28,
    font: ctx.fonts.bold,
    color: ctx.ink,
  });
  y -= 28;
  if (d.adresse) {
    ctx.page.drawText(latin1(d.adresse), { x: 48, y, size: 12, font: ctx.fonts.regular, color: ctx.ink });
    y -= 18;
  }
  if (d.client.nom) {
    ctx.page.drawText(latin1(`A la demande de ${d.client.nom}`), {
      x: 48,
      y,
      size: 11,
      font: ctx.fonts.regular,
      color: ctx.mute,
    });
    y -= 16;
  }
  const date = formatDateRapport(d.dateEvaluation);
  if (date) {
    ctx.page.drawText(latin1(date), { x: 48, y, size: 11, font: ctx.fonts.regular, color: ctx.mute });
  }
  if (d.agence.logoUrl) {
    try {
      const logo = await embedRemote(doc, d.agence.logoUrl);
      if (logo) {
        const h = 28;
        const w = (logo.width / logo.height) * h;
        ctx.page.drawImage(logo.img, { x: 48, y: 40, width: w, height: h });
      }
    } catch {
      /* logo optionnel */
    }
  } else {
    ctx.page.drawText(latin1(d.agence.nomCommercial), {
      x: 48,
      y: 44,
      size: 11,
      font: ctx.fonts.bold,
      color: ctx.accent,
    });
  }
}

async function carte(doc: PDFDocument, ctx: Ctx, lat: number, lng: number, x: number, y: number) {
  try {
    const url = urlCarteIgn({ latitude: lat, longitude: lng, width: 400, height: 220, spanM: 1200 });
    const img = await embedRemote(doc, url);
    if (!img) return;
    ctx.page.drawImage(img.img, { x, y, width: 280, height: 154 });
    ctx.page.drawText(latin1(ATTRIBUTION_IGN), {
      x,
      y: y - 10,
      size: 7,
      font: ctx.fonts.regular,
      color: ctx.mute,
    });
  } catch {
    /* carte optionnelle */
  }
}

async function embedRemote(doc: PDFDocument, url: string) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  const mime = res.headers.get('content-type') ?? '';
  const img =
    mime.includes('png') || bytes[0] === 0x89 ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  return { img, width: img.width, height: img.height };
}
