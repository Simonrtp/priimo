import { DPE_PALETTE, formatDpeEtage, parseDpeLetter } from '@/lib/carte/dpe-public';
import { formatPrixM2Court } from '@/lib/carte/cadastre-overlay';
import type { CadastreOverlayId } from '@/lib/carte/layers';
import type { CadastreImmeublePoint } from '@/lib/carte/parcelle';
import type { MapPoint, MapPointKind } from '@/lib/carte/points';
import { formatPhoneDisplay } from '@/lib/import/normalize';

export type HoverPreview = {
  kindLabel: string;
  title: string;
  lines: string[];
  letter?: string;
  swatch?: string;
};

const KIND_LABEL: Record<MapPointKind, string> = {
  lead: 'Prospect',
  contact: 'Contact',
  bien: 'Bien',
  note: 'Note',
};

export function formatHoverEuros(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(value))} €`;
}

export function formatHoverDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(t),
  );
}

function takeBits(subtitle: string, title: string, already: readonly string[], max: number): string[] {
  const extra: string[] = [];
  for (const bit of subtitle.split(' · ')) {
    const t = bit.trim();
    if (!t || t === title || already.includes(t) || extra.includes(t)) continue;
    extra.push(t);
    if (already.length + extra.length >= max) break;
  }
  return extra;
}

export function hoverPreviewFromPoint(point: MapPoint, ficheCount = 1): HoverPreview {
  const lines: string[] = [];
  if (point.kind === 'lead' && point.score != null) {
    lines.push(`${Math.round(point.score)} / 100`);
  }
  if (point.kind === 'contact' && point.phone) {
    lines.push(formatPhoneDisplay(point.phone));
  }
  lines.push(...takeBits(point.subtitle, point.title, lines, 3));
  if (ficheCount > 1) lines.push(`${ficheCount} fiches à cette adresse`);
  return {
    kindLabel: KIND_LABEL[point.kind],
    title: point.title,
    lines: lines.slice(0, 4),
  };
}

export function hoverPreviewFromCadastre(
  row: CadastreImmeublePoint,
  layer: CadastreOverlayId,
): HoverPreview {
  const adresse = (row.adresse ?? '').trim() || 'Immeuble';
  if (layer === 'dpe') {
    const letter = parseDpeLetter(row.etiquetteDpe);
    const lines = [adresse];
    const date = formatHoverDay(row.dateDpe);
    if (date) lines.push(date);
    if (row.surfaceDpe != null && Number.isFinite(row.surfaceDpe)) {
      lines.push(`${Math.round(row.surfaceDpe)} m²`);
    }
    lines.push(formatDpeEtage(row.etageDpe));
    return {
      kindLabel: 'DPE',
      title: letter ? `Classe ${letter}` : 'Diagnostics',
      lines,
      letter: letter ?? undefined,
      swatch: letter ? DPE_PALETTE[letter] : undefined,
    };
  }
  if (layer === 'ventes') {
    const lines = [adresse];
    const date = formatHoverDay(row.derniereTransactionLe);
    const prix = formatHoverEuros(row.dernierPrix);
    if (date && prix) lines.push(`${date} · ${prix}`);
    else if (prix) lines.push(prix);
    else if (date) lines.push(date);
    const median = formatPrixM2Court(row.prixM2);
    if (median) lines.push(`${median} médian`);
    if (row.nbTransactions > 0) {
      lines.push(
        `${row.nbTransactions} vente${row.nbTransactions > 1 ? 's' : ''} connue${row.nbTransactions > 1 ? 's' : ''}`,
      );
    }
    return {
      kindLabel: 'Vente',
      title: adresse,
      lines: lines.slice(1),
    };
  }
  const lines = [adresse];
  if (row.procedureCopro) lines.push('Procédure en cours');
  return {
    kindLabel: 'Copropriété',
    title: row.nbLots != null ? `${row.nbLots} lot${row.nbLots > 1 ? 's' : ''}` : 'Copropriété',
    lines: lines.slice(0, 3),
  };
}
