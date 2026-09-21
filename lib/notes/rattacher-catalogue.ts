import type { NoteLienEntite } from '@/types/contact';

export type RattacherKind = 'contact' | 'bien' | 'lead' | 'immeuble';

export type RattacherItem = {
  id: string;
  kind: RattacherKind;
  label: string;
  subtitle: string | null;
};

export const RATTACHER_CARTES: { id: RattacherKind; label: string; entite: NoteLienEntite }[] = [
  { id: 'contact', label: 'Contact', entite: 'contact' },
  { id: 'bien', label: 'Bien', entite: 'bien' },
  { id: 'lead', label: 'Prospect', entite: 'lead' },
  { id: 'immeuble', label: 'Immeuble', entite: 'immeuble' },
];

export function normaliserRecherche(q: string): string {
  return q
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr')
    .trim();
}

export function filtrerCatalogue(items: RattacherItem[], query: string): RattacherItem[] {
  const needle = normaliserRecherche(query);
  if (!needle) return items;
  return items.filter((item) => {
    const hay = normaliserRecherche(`${item.label} ${item.subtitle ?? ''}`);
    return hay.includes(needle);
  });
}

export type ContactRattacher = {
  id: string;
  fullName: string;
  phone: string | null;
  address: string | null;
  banId: string | null;
};

export type BienRattacher = {
  proprietaireContactId: string | null;
  address: string;
  banId?: string | null;
};

function unique(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    const key = normaliserRecherche(value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function adressesCompatibles(a: string | null | undefined, b: string | null | undefined): boolean {
  const aa = normaliserRecherche(a ?? '');
  const bb = normaliserRecherche(b ?? '');
  if (!aa || !bb) return false;
  return aa === bb || aa.startsWith(bb) || bb.startsWith(aa);
}

function memeLieu(a: ContactRattacher, b: ContactRattacher): boolean {
  if (a.banId && b.banId) return a.banId === b.banId;
  return adressesCompatibles(a.address, b.address);
}

function contactSurBien(contact: ContactRattacher, bien: BienRattacher): boolean {
  if (bien.proprietaireContactId === contact.id) return true;
  if (contact.banId && bien.banId) return contact.banId === bien.banId;
  return adressesCompatibles(contact.address, bien.address);
}

/** Bien(s) et autres contacts du même lieu, pour la ligne de recherche. */
export function ligneRattachementContact(
  contact: ContactRattacher,
  biens: readonly BienRattacher[],
  contacts: readonly ContactRattacher[],
): string | null {
  const biensLies = biens.filter((b) => contactSurBien(contact, b)).map((b) => b.address);
  const autres = contacts
    .filter((o) => o.id !== contact.id && memeLieu(contact, o))
    .map((o) => o.fullName);
  const parts = unique([...biensLies, ...autres]);
  if (parts.length > 0) return parts.join(' · ');
  return [contact.phone, contact.address].filter(Boolean).join(' · ') || null;
}
