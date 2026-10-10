import type { NoteLien, NoteLienEntite } from '@/types/contact';
import { formatParcelleId } from '@/lib/carte/parcelle-id';

export const LIBELLE_ENTITE: Record<NoteLienEntite, string> = {
  contact: 'Contact',
  bien: 'Bien',
  lead: 'Prospect',
  immeuble: 'Adresse',
  parcelle: 'Parcelle',
};

export type RattachementAffiche = {
  type: NoteLienEntite;
  id: string;
  label: string;
  href: string | null;
};

export type LieuCarte = {
  latitude: number;
  longitude: number;
  libelle: string;
};

function lieuValide(lieu: LieuCarte | null | undefined): lieu is LieuCarte {
  return Boolean(
    lieu &&
      Number.isFinite(lieu.latitude) &&
      Number.isFinite(lieu.longitude) &&
      Math.abs(lieu.latitude) <= 90 &&
      Math.abs(lieu.longitude) <= 180,
  );
}

/** L'immeuble sur la carte : la fiche s'ouvre, et la carte s'y pose si on a le point. */
export function hrefImmeuble(id: string, lieu?: LieuCarte | null): string {
  const params = new URLSearchParams({ vue: 'carte', immeuble: id });
  if (lieuValide(lieu)) {
    params.set('pos', `${lieu.latitude.toFixed(6)},${lieu.longitude.toFixed(6)}`);
    const libelle = lieu.libelle.trim().slice(0, 160);
    if (libelle) params.set('libelle', libelle);
  }
  return `/dashboard/prospection?${params.toString()}`;
}

/** Le volet de la parcelle, sur la carte. */
export function hrefParcelle(id: string): string {
  return `/dashboard/prospection?vue=carte&parcelle=${encodeURIComponent(id)}`;
}

/** `lat,lng` posé à côté de `immeuble` — distinct de la recherche d'adresse. */
export function lirePosCarte(raw: string | null | undefined): { latitude: number; longitude: number } | null {
  const m = raw?.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const latitude = Number(m[1]);
  const longitude = Number(m[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

export function hrefRattachement(type: NoteLienEntite, id: string, lieu?: LieuCarte | null): string {
  if (type === 'contact') return `/dashboard/contacts?fiche=${encodeURIComponent(id)}`;
  if (type === 'bien') return `/dashboard/biens?fiche=${encodeURIComponent(id)}`;
  if (type === 'lead') return `/dashboard/prospection?lead=${encodeURIComponent(id)}`;
  if (type === 'immeuble') return hrefImmeuble(id, lieu);
  return hrefParcelle(id);
}

/** Libellé d'une parcelle : la référence cadastrale, pas l'identifiant compact. */
export function libelleParcelle(id: string): string {
  return `Parcelle ${formatParcelleId(id)}`;
}

/**
 * Ce que l'agent doit voir quand la note part d'une parcelle.
 * L'adresse d'abord, la référence en dessous — jamais deux fois la même ligne.
 */
export function ancrageParcelle(
  parcelleId: string | null | undefined,
  adresse: string | null | undefined,
): { titre: string; detail: string | null } | null {
  if (!parcelleId) return null;
  const reference = formatParcelleId(parcelleId);
  const lieu = (adresse ?? '').trim();
  const nommee = lieu.length > 0 && lieu !== reference;
  return {
    titre: nommee ? lieu : `Parcelle ${reference}`,
    detail: nommee ? `Parcelle ${reference}` : null,
  };
}

export function nomContact(prenom: string | null | undefined, nom: string | null | undefined): string {
  const pieces = [prenom, nom].map((s) => (s ?? '').trim()).filter(Boolean);
  return pieces.join(' ') || 'Contact';
}

/**
 * Une note est rattachée dès qu'un lien existe — y compris immeuble et
 * parcelle, que `hasFicheLink` ignore (il ne compte que contact / bien / lead).
 */
export function estRattachee(rattachements: readonly RattachementAffiche[]): boolean {
  return rattachements.length > 0;
}

export function syntheseRattachement(rattachements: readonly RattachementAffiche[]): string | null {
  if (rattachements.length === 0) return null;
  const premier = rattachements[0];
  if (!premier) return null;
  if (rattachements.length === 1) return premier.label;
  return `${premier.label} · +${rattachements.length - 1}`;
}

/** Déduplique les liens d'une note, contact_id compris. */
export function idsParType(
  liens: readonly Pick<NoteLien, 'entiteType' | 'entiteId'>[],
  contactId: string | null,
): Map<NoteLienEntite, string[]> {
  const parType = new Map<NoteLienEntite, string[]>();
  function push(type: NoteLienEntite, id: string) {
    const trimmed = id.trim();
    if (!trimmed) return;
    const list = parType.get(type) ?? [];
    if (list.includes(trimmed)) return;
    list.push(trimmed);
    parType.set(type, list);
  }
  for (const lien of liens) push(lien.entiteType, lien.entiteId);
  if (contactId) push('contact', contactId);
  return parType;
}
