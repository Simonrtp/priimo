import type {
  AgencyRapportPageRow,
  EstimationRapportPageKind,
  EstimationRapportPageRow,
  EstimationRapportPageSource,
} from '@/types/database';

export const RAPPORT_BUCKET = 'rapport-pages';
export const MAX_RAPPORT_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_PAGES_PDF = 40;

export const MIME_PAGES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

export type PageBibliotheque = {
  id: string;
  nom: string;
  description: string | null;
  kind: 'pdf' | 'image';
  storagePath: string;
  mimeType: string;
  pageCount: number;
  position: number;
  previewUrl: string | null;
};

export type PageRapportComposee = {
  id: string;
  source: EstimationRapportPageSource;
  bibliothequeId: string | null;
  nom: string;
  kind: EstimationRapportPageKind;
  storagePath: string | null;
  mimeType: string | null;
  pageIndex: number;
  position: number;
  previewUrl: string | null;
};

export function kindDepuisMime(mime: string): 'pdf' | 'image' | null {
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  return null;
}

export function extensionMime(mime: string): string {
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

export function mapPageBibliotheque(
  row: AgencyRapportPageRow,
  previewUrl: string | null,
): PageBibliotheque {
  return {
    id: row.id,
    nom: row.nom,
    description: row.description,
    kind: row.kind,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    pageCount: row.page_count,
    position: row.position,
    previewUrl,
  };
}

export function mapPageComposee(
  row: EstimationRapportPageRow,
  previewUrl: string | null,
): PageRapportComposee {
  return {
    id: row.id,
    source: row.source,
    bibliothequeId: row.bibliotheque_id,
    nom: row.nom,
    kind: row.kind,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    pageIndex: row.page_index,
    position: row.position,
    previewUrl,
  };
}

export function reordonnerIds(ids: string[], from: number, to: number): string[] {
  if (from < 0 || to < 0 || from >= ids.length || to >= ids.length || from === to) {
    return [...ids];
  }
  const next = [...ids];
  const [item] = next.splice(from, 1);
  if (!item) return [...ids];
  next.splice(to, 0, item);
  return next;
}

export function nomFichierPropre(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').trim();
  return base.slice(0, 80) || 'Page';
}
