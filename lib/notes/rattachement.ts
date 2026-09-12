import type { NoteLien, NoteLienEntite } from '@/types/contact';
import { formatParcelleId } from '@/lib/carte/parcelle-id';

export const LIBELLE_ENTITE: Record<NoteLienEntite, string> = {
  contact: 'Contact',
  bien: 'Bien',
  lead: 'Prospect',
  immeuble: 'Immeuble',
  parcelle: 'Parcelle',
};

export type RattachementAffiche = {
  type: NoteLienEntite;
  id: string;
  label: string;
  href: string | null;
};

export function hrefRattachement(type: NoteLienEntite, id: string): string | null {
  if (type === 'contact') return `/dashboard/contacts?fiche=${encodeURIComponent(id)}`;
  if (type === 'bien') return `/dashboard/biens?fiche=${encodeURIComponent(id)}`;
  if (type === 'lead') return `/dashboard/prospection?lead=${encodeURIComponent(id)}`;
  return null;
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
