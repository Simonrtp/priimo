import type { NoteLienEntite } from '@/types/contact';

export type RattacherKind = 'contact' | 'bien' | 'lead' | 'immeuble';

export type RattacherItem = {
  id: string;
  kind: RattacherKind;
  label: string;
  subtitle: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  banId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  proprietaireContactId?: string | null;
  propertyType?: string | null;
  surfaceM2?: number | null;
  rooms?: number | null;
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

const MOTS_VOIE = new Set([
  'rue',
  'avenue',
  'av',
  'boulevard',
  'bd',
  'impasse',
  'place',
  'allee',
  'chemin',
  'quai',
  'cours',
  'route',
  'passage',
  'de',
  'du',
  'des',
  'la',
  'le',
  'les',
]);

export function biensCitesDansTexte(
  transcript: string,
  biens: readonly { id: string; address: string; city?: string | null }[],
): { id: string; label: string }[] {
  const texte = normaliserRecherche(transcript);
  if (texte.length < 6) return [];
  const out: { id: string; label: string }[] = [];
  for (const bien of biens) {
    const adr = normaliserRecherche(bien.address);
    if (adr.length < 6) continue;
    if (texte.includes(adr)) {
      out.push({ id: bien.id, label: bien.address });
      continue;
    }
    const num = adr.match(/^\d+/);
    const ville = normaliserRecherche(bien.city ?? '');
    const motsRue = adr
      .split(/[^\p{L}\p{N}]+/u)
      .filter((m) => m.length > 2 && !MOTS_VOIE.has(m) && m !== ville);
    if (
      num &&
      motsRue.length >= 1 &&
      texte.includes(num[0]) &&
      motsRue.every((m) => texte.includes(m))
    ) {
      out.push({ id: bien.id, label: bien.address });
    }
  }
  return out;
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
  latitude?: number | null;
  longitude?: number | null;
};

export type BienRattacher = {
  id?: string;
  proprietaireContactId: string | null;
  address: string;
  city?: string | null;
  postalCode?: string | null;
  banId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  propertyType?: string | null;
  surfaceM2?: number | null;
  rooms?: number | null;
};

export type AdresseProposee = {
  key: string;
  source: 'bien' | 'contact';
  bienId: string | null;
  label: string;
  city: string | null;
  postalCode: string | null;
  banId: string | null;
  latitude: number | null;
  longitude: number | null;
  propertyType: 'appartement' | 'maison' | null;
  surfaceM2: number | null;
  rooms: number | null;
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

export function extraireCodePostal(adresse: string | null | undefined): string | null {
  const m = (adresse ?? '').match(/\b(\d{5})\b/);
  return m?.[1] ?? null;
}

export function extraireVille(
  adresse: string | null | undefined,
  codePostal: string | null,
): string | null {
  if (!adresse || !codePostal) return null;
  const after = adresse.split(codePostal)[1]?.replace(/^[\s,]+/, '').trim();
  return after || null;
}

export function typeBienEstimation(
  raw: string | null | undefined,
): 'appartement' | 'maison' | null {
  const t = (raw ?? '').toLocaleLowerCase('fr');
  if (!t) return null;
  if (t.includes('maison')) return 'maison';
  if (t.includes('appart')) return 'appartement';
  return null;
}

export function contactDepuisItem(item: RattacherItem): ContactRattacher {
  return {
    id: item.id,
    fullName: item.label,
    phone: null,
    address: item.address ?? null,
    banId: item.banId ?? null,
    latitude: item.latitude ?? null,
    longitude: item.longitude ?? null,
  };
}

export function bienDepuisItem(item: RattacherItem): BienRattacher {
  return {
    id: item.id,
    proprietaireContactId: item.proprietaireContactId ?? null,
    address: item.address ?? item.label,
    city: item.city ?? null,
    postalCode: item.postalCode ?? null,
    banId: item.banId ?? null,
    latitude: item.latitude ?? null,
    longitude: item.longitude ?? null,
    propertyType: item.propertyType ?? null,
    surfaceM2: item.surfaceM2 ?? null,
    rooms: item.rooms ?? null,
  };
}

function propositionDepuisBien(b: BienRattacher): AdresseProposee | null {
  const label = b.address.trim();
  if (!label) return null;
  const postalCode = b.postalCode?.trim() || extraireCodePostal(label);
  return {
    key: b.id ? `bien:${b.id}` : `bien:${normaliserRecherche(label)}`,
    source: 'bien',
    bienId: b.id ?? null,
    label,
    city: b.city?.trim() || extraireVille(label, postalCode),
    postalCode,
    banId: b.banId ?? null,
    latitude: b.latitude ?? null,
    longitude: b.longitude ?? null,
    propertyType: typeBienEstimation(b.propertyType),
    surfaceM2: b.surfaceM2 ?? null,
    rooms: b.rooms ?? null,
  };
}

function propositionDepuisContact(c: ContactRattacher): AdresseProposee | null {
  const label = c.address?.trim();
  if (!label) return null;
  const postalCode = extraireCodePostal(label);
  return {
    key: `contact:${c.id}`,
    source: 'contact',
    bienId: null,
    label,
    city: extraireVille(label, postalCode),
    postalCode,
    banId: c.banId,
    latitude: c.latitude ?? null,
    longitude: c.longitude ?? null,
    propertyType: null,
    surfaceM2: null,
    rooms: null,
  };
}

function uniquePropositions(items: AdresseProposee[]): AdresseProposee[] {
  const out: AdresseProposee[] = [];
  for (const item of items) {
    const deja = out.some(
      (p) =>
        (p.banId && item.banId && p.banId === item.banId) ||
        adressesCompatibles(p.label, item.label),
    );
    if (deja) continue;
    out.push(item);
  }
  return out;
}

/** Appartements liés, sinon l’adresse de la fiche client. */
export function adressesProposeesPourContact(
  contact: ContactRattacher,
  biens: readonly BienRattacher[],
): AdresseProposee[] {
  const fromBiens = biens
    .filter((b) => contactSurBien(contact, b))
    .flatMap((b) => {
      const p = propositionDepuisBien(b);
      return p ? [p] : [];
    });
  const fromContact = propositionDepuisContact(contact);
  if (!fromContact) return uniquePropositions(fromBiens);
  const deja = fromBiens.some(
    (p) =>
      (p.banId && contact.banId && p.banId === contact.banId) ||
      adressesCompatibles(p.label, fromContact.label),
  );
  return uniquePropositions(deja ? fromBiens : [...fromBiens, fromContact]);
}

export function fusionnerAdressesProposees(
  fiche: AdresseProposee | null,
  remote: readonly AdresseProposee[],
): AdresseProposee[] {
  const ordered = [
    ...remote.filter((p) => p.source === 'bien'),
    ...(fiche && fiche.source === 'bien' ? [fiche] : []),
    ...remote.filter((p) => p.source !== 'bien'),
    ...(fiche && fiche.source !== 'bien' ? [fiche] : []),
  ];
  return uniquePropositions(ordered);
}

export function adresseDejaAppliquee(
  actuel: { address?: string | null; bienId?: string | null },
  p: AdresseProposee,
): boolean {
  if (p.bienId && actuel.bienId === p.bienId && adressesCompatibles(actuel.address, p.label)) {
    return true;
  }
  return adressesCompatibles(actuel.address, p.label);
}

export function patchDepuisAdresseProposee(
  p: AdresseProposee,
  actuel: {
    propertyType?: string | null;
    surfaceM2?: number | null;
    rooms?: number | null;
  },
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    address: p.label,
    postalCode: p.postalCode,
    city: p.city,
    banId: p.banId,
    latitude: p.latitude,
    longitude: p.longitude,
  };
  if (p.bienId) body.bienId = p.bienId;
  if (!actuel.propertyType && p.propertyType) body.propertyType = p.propertyType;
  if (actuel.surfaceM2 == null && p.surfaceM2 != null) body.surfaceM2 = p.surfaceM2;
  if (actuel.rooms == null && p.rooms != null) body.rooms = p.rooms;
  return body;
}
