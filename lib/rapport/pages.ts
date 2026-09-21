import type {
  AgencyRapportPageKind,
  AgencyRapportPageRow,
  DispositionPageAgence,
  EstimationRapportPageKind,
  EstimationRapportPageRow,
  EstimationRapportPageSource,
} from '@/types/database';
import { estDisposition, normaliserContenu, type ContenuPageModele } from '@/lib/rapport/modele';
import { estKindGeneree, type KindGeneree } from '@/lib/rapport/modele-defaut';

export const RAPPORT_BUCKET = 'rapport-pages';
export const MAX_RAPPORT_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_PAGES_PDF = 40;

export const MIME_PAGES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
export const MIME_IMAGE_MODELE = new Set(['image/jpeg', 'image/png']);

const MIME_ALIAS: Record<string, string> = {
  'application/pdf': 'application/pdf',
  'application/x-pdf': 'application/pdf',
  'application/acrobat': 'application/pdf',
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png',
};

const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export type PageBibliotheque = {
  id: string;
  nom: string;
  description: string | null;
  kind: AgencyRapportPageKind;
  storagePath: string | null;
  mimeType: string | null;
  pageCount: number;
  position: number;
  previewUrl: string | null;
  disposition: DispositionPageAgence | null;
  contenu: ContenuPageModele;
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
  disposition: DispositionPageAgence | null;
  contenu: ContenuPageModele | null;
  kindGeneree: KindGeneree | null;
  manques: string[];
};

export function kindDepuisMime(mime: string): 'pdf' | 'image' | null {
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  return null;
}

export function estFichierUpload(value: unknown): value is Blob & { name?: string; type: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Blob).arrayBuffer === 'function' &&
    typeof (value as Blob).size === 'number'
  );
}

export function mimeDepuisOctets(bytes: Uint8Array): string | null {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'application/pdf';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

export function mimeDepuisNom(name: string): string | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MIME[ext] ?? null;
}

export function normaliserMime(mime: string): string | null {
  const clean = mime.split(';')[0]?.trim().toLowerCase() ?? '';
  if (MIME_ALIAS[clean]) return MIME_ALIAS[clean];
  if (MIME_PAGES.has(clean)) return clean;
  return null;
}

/** Windows envoie souvent `type` vide : on lit d’abord les octets, puis le MIME, puis l’extension. */
export function detecterFichier(
  file: { type?: string; name?: string },
  bytes: Uint8Array,
): { mime: string; kind: 'pdf' | 'image' } | null {
  const mime = mimeDepuisOctets(bytes) ?? normaliserMime(file.type ?? '') ?? mimeDepuisNom(file.name ?? '');
  if (!mime) return null;
  const kind = kindDepuisMime(mime);
  if (!kind) return null;
  return { mime, kind };
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
    disposition: estDisposition(row.disposition) ? row.disposition : null,
    contenu: normaliserContenu(row.contenu),
  };
}

export function kindGenereeDepuisContenu(raw: unknown): KindGeneree | null {
  if (!raw || typeof raw !== 'object') return null;
  const k = (raw as { kind?: unknown }).kind;
  return estKindGeneree(k) ? k : null;
}

export function mapPageComposee(
  row: EstimationRapportPageRow,
  previewUrl: string | null,
  extra?: { manques?: string[] },
): PageRapportComposee {
  const kindGeneree = row.kind === 'generee' ? kindGenereeDepuisContenu(row.contenu) : null;
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
    disposition: estDisposition(row.disposition) ? row.disposition : null,
    contenu: row.kind === 'generee' ? null : row.contenu ? normaliserContenu(row.contenu) : null,
    kindGeneree,
    manques: extra?.manques ?? [],
  };
}

export function pageExportable(page: PageRapportComposee): boolean {
  if (page.kind !== 'generee') return true;
  return page.manques.length === 0;
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
