import { DPE_PALETTE, parseDpeLetter } from '@/lib/carte/dpe-public';
import type { CadastreLayerId } from '@/lib/carte/layers';
import type { CadastreImmeublePoint } from '@/lib/carte/parcelle';
import type { MapPoint, MapPointKind } from '@/lib/carte/points';

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
    lines.push(point.phone);
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
  layer: CadastreLayerId,
): HoverPreview {
  const adresse = (row.adresse ?? '').trim() || 'Immeuble';
  if (layer === 'dpe') {
    const letter = parseDpeLetter(row.etiquetteDpe);
    const lines = [adresse];
    if (row.nbDpe > 0) lines.push(`${row.nbDpe} diagnostic${row.nbDpe > 1 ? 's' : ''}`);
    if (row.nbPassoires > 0) {
      lines.push(`${row.nbPassoires} passoire${row.nbPassoires > 1 ? 's' : ''}`);
    }
    return {
      kindLabel: 'DPE',
      title: letter ? `Classe ${letter}` : 'Diagnostics',
      lines: lines.slice(0, 3),
      letter: letter ?? undefined,
      swatch: letter ? DPE_PALETTE[letter] : undefined,
    };
  }
  if (layer === 'ventes') {
    const lines = [adresse];
    if (row.nbTransactions > 0) {
      lines.push(`${row.nbTransactions} vente${row.nbTransactions > 1 ? 's' : ''}`);
    }
    const m2 = formatHoverEuros(row.prixM2);
    if (m2) lines.push(`${m2} / m²`);
    return {
      kindLabel: 'Vente',
      title: formatHoverEuros(row.dernierPrix) ?? 'Mutation',
      lines: lines.slice(0, 3),
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
