import { toGeoCoord } from '@/lib/carte/coords';
import { BIEN_MARKER_COLOR, CONTACT_TYPE_COLORS, leadMarkerColor, NOTE_MARKER_COLOR } from '@/lib/carte/colors';
import { CONTACT_TYPE_LABELS, type Contact, type ContactType } from '@/types/contact';
import type { Bien } from '@/types/bien';
import { MANDAT_STATUT_LABELS } from '@/types/bien';
import type { Lead } from '@/types/lead';

export type MapPointKind = 'lead' | 'contact' | 'bien' | 'note';

export type MapPoint = {
  id: string;
  kind: MapPointKind;
  recordId: string;
  banId: string;
  latitude: number;
  longitude: number;
  postalCode: string | null;
  title: string;
  subtitle: string;
  href: string;
  color: string;
  badge: string;
  score?: number;
  contactType?: ContactType;
  assignedTo: string | null;
  occurredAt: string;
  phone?: string | null;
};

export type MappableLead = Pick<
  Lead,
  | 'id'
  | 'agencyId'
  | 'address'
  | 'city'
  | 'postalCode'
  | 'score'
  | 'mainSignalLabel'
  | 'propertyType'
  | 'surfaceM2'
  | 'banId'
  | 'latitude'
  | 'longitude'
  | 'assignedTo'
  | 'createdAt'
  | 'deliveredAt'
>;

export type MappableContact = Pick<
  Contact,
  | 'id'
  | 'agencyId'
  | 'fullName'
  | 'type'
  | 'phone'
  | 'secteur'
  | 'address'
  | 'banId'
  | 'leadId'
  | 'latitude'
  | 'longitude'
  | 'assignedTo'
  | 'lastInteractionAt'
  | 'createdAt'
  | 'source'
> & { postalCodes?: string[] };

export type MappableBien = Pick<
  Bien,
  | 'id'
  | 'agencyId'
  | 'address'
  | 'city'
  | 'postalCode'
  | 'price'
  | 'mandatStatut'
  | 'leadId'
  | 'propertyType'
  | 'surfaceM2'
  | 'banId'
  | 'latitude'
  | 'longitude'
  | 'createdBy'
  | 'createdAt'
  | 'updatedAt'
>;

export type MappableNote = {
  id: string;
  agencyId: string;
  contactId: string | null;
  hasFicheLink?: boolean;
  transcript: string | null;
  adresseNormalisee: string | null;
  banId: string | null;
  latitude: number | null;
  longitude: number | null;
  assignedTo: string | null;
  createdBy: string | null;
  createdAt: string;
  postalCode?: string | null;
  visibilite?: 'agence' | 'privee';
  sourceInfo?: string | null;
};

export type UnplacedRecord = {
  kind: MapPointKind;
  recordId: string;
  title: string;
  href: string;
  geocodeQuery: string | null;
  postalCode: string | null;
};

export type WithoutPositionCount = {
  leads: number;
  contacts: number;
  biens: number;
  notes: number;
};

const CONTACT_BADGE: Record<ContactType, string> = {
  vendeur: 'V',
  acquereur: 'A',
  locataire: 'L',
  gardien: 'G',
  commercant: 'C',
  autre: '·',
};

function postalFromList(codes: readonly string[] | undefined): string | null {
  return codes?.find((code) => /^\d{5}$/.test(code)) ?? null;
}

function euros(value: number | null): string | null {
  if (value === null) return null;
  return `${new Intl.NumberFormat('fr-FR').format(value)} €`;
}

function leadSubtitle(lead: MappableLead): string {
  const bits = [
    lead.mainSignalLabel,
    lead.propertyType,
    lead.surfaceM2 ? `${lead.surfaceM2} m²` : null,
    [lead.postalCode, lead.city].filter(Boolean).join(' ') || null,
  ].filter(Boolean);
  return bits.join(' · ') || 'Adresse détectée';
}

function contactSubtitle(contact: MappableContact, postalCode: string | null): string {
  const bits = [
    CONTACT_TYPE_LABELS[contact.type],
    contact.secteur,
    postalCode,
    contact.phone,
  ].filter(Boolean);
  return bits.join(' · ');
}

function bienSubtitle(bien: MappableBien): string {
  const bits = [
    MANDAT_STATUT_LABELS[bien.mandatStatut],
    bien.propertyType,
    bien.surfaceM2 ? `${bien.surfaceM2} m²` : null,
    euros(bien.price),
    [bien.postalCode, bien.city].filter(Boolean).join(' ') || null,
  ].filter(Boolean);
  return bits.join(' · ');
}

function noteTitle(note: MappableNote): string {
  const label = (note.adresseNormalisee ?? '').trim();
  if (label) return label;
  const excerpt = (note.transcript ?? '').trim().replace(/\s+/g, ' ').slice(0, 72);
  return excerpt || 'Note terrain';
}

function placeable(
  banId: string | null | undefined,
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  fallbackBanId?: string | null,
): { banId: string; latitude: number; longitude: number } | null {
  const coord = toGeoCoord(latitude, longitude);
  if (!coord) return null;
  const id = (banId ?? '').trim() || (fallbackBanId ?? '').trim();
  if (!id) return null;
  return { banId: id, ...coord };
}

export function leadToMapPoint(lead: MappableLead): MapPoint | null {
  const placed = placeable(lead.banId, lead.latitude, lead.longitude);
  if (!placed) return null;
  return {
    id: `lead:${lead.id}`,
    kind: 'lead',
    recordId: lead.id,
    banId: placed.banId,
    latitude: placed.latitude,
    longitude: placed.longitude,
    postalCode: lead.postalCode,
    title: lead.address,
    subtitle: leadSubtitle(lead),
    href: `/dashboard/prospection?lead=${lead.id}`,
    color: leadMarkerColor(lead.score),
    badge: String(Math.round(lead.score)),
    score: lead.score,
    assignedTo: lead.assignedTo,
    occurredAt: lead.deliveredAt ?? lead.createdAt,
  };
}

export function contactToMapPoint(contact: MappableContact): MapPoint | null {
  if (contact.source === 'vocal') return null;
  const placed = placeable(contact.banId, contact.latitude, contact.longitude);
  if (!placed) return null;
  const postalCode = postalFromList(contact.postalCodes);
  return {
    id: `contact:${contact.id}`,
    kind: 'contact',
    recordId: contact.id,
    banId: placed.banId,
    latitude: placed.latitude,
    longitude: placed.longitude,
    postalCode,
    title: contact.fullName,
    subtitle: contactSubtitle(contact, postalCode),
    href: `/dashboard/contacts?fiche=${contact.id}`,
    color: CONTACT_TYPE_COLORS[contact.type],
    badge: CONTACT_BADGE[contact.type],
    contactType: contact.type,
    assignedTo: contact.assignedTo,
    occurredAt: contact.lastInteractionAt ?? contact.createdAt,
    phone: contact.phone,
  };
}

export function bienToMapPoint(bien: MappableBien): MapPoint | null {
  const placed = placeable(bien.banId, bien.latitude, bien.longitude, `bien:${bien.id}`);
  if (!placed) return null;
  return {
    id: `bien:${bien.id}`,
    kind: 'bien',
    recordId: bien.id,
    banId: placed.banId,
    latitude: placed.latitude,
    longitude: placed.longitude,
    postalCode: bien.postalCode,
    title: bien.address,
    subtitle: bienSubtitle(bien),
    href: `/dashboard/biens?fiche=${bien.id}`,
    color: BIEN_MARKER_COLOR,
    badge: 'B',
    assignedTo: bien.createdBy,
    occurredAt: bien.updatedAt,
  };
}

export function noteToMapPoint(note: MappableNote): MapPoint | null {
  const linked = note.hasFicheLink ?? Boolean(note.contactId);
  if (linked) return null;
  const coord = toGeoCoord(note.latitude, note.longitude);
  if (!coord) return null;
  const banId = (note.banId ?? '').trim() || `gps:${note.id}`;
  return {
    id: `note:${note.id}`,
    kind: 'note',
    recordId: note.id,
    banId,
    latitude: coord.latitude,
    longitude: coord.longitude,
    postalCode: note.postalCode ?? null,
    title: noteTitle(note),
    subtitle: 'Note terrain',
    href: `/dashboard/carte?immeuble=${encodeURIComponent(banId)}`,
    color: NOTE_MARKER_COLOR,
    badge: 'N',
    assignedTo: note.assignedTo ?? note.createdBy,
    occurredAt: note.createdAt,
  };
}

export function noteToBuildingPoint(note: MappableNote): MapPoint | null {
  const coord = toGeoCoord(note.latitude, note.longitude);
  if (!coord) return null;
  const banId = (note.banId ?? '').trim() || `gps:${note.id}`;
  return {
    id: `note:${note.id}`,
    kind: 'note',
    recordId: note.id,
    banId,
    latitude: coord.latitude,
    longitude: coord.longitude,
    postalCode: note.postalCode ?? null,
    title: noteTitle(note),
    subtitle: 'Note terrain',
    href: `/dashboard/carte?immeuble=${encodeURIComponent(banId)}`,
    color: NOTE_MARKER_COLOR,
    badge: 'N',
    assignedTo: note.assignedTo ?? note.createdBy,
    occurredAt: note.createdAt,
  };
}

/**
 * Ne garde que les fiches de *cette* agence, et seulement celles qui ont un
 * ban_id. Filet applicatif : le RLS a déjà isolé inter-agences.
 */
export function buildSectorMapPoints({
  agencyId,
  leads,
  contacts,
  biens,
  notes = [],
}: {
  agencyId: string;
  leads: readonly MappableLead[];
  contacts: readonly MappableContact[];
  biens: readonly MappableBien[];
  notes?: readonly MappableNote[];
}): {
  points: MapPoint[];
  withoutPosition: WithoutPositionCount;
  unplaced: UnplacedRecord[];
} {
  const ownLeads = leads.filter((l) => l.agencyId === agencyId);
  const ownContacts = contacts.filter((c) => c.agencyId === agencyId);
  const ownBiens = biens.filter((b) => b.agencyId === agencyId);
  const ownNotes = notes.filter((n) => n.agencyId === agencyId);

  const points: MapPoint[] = [];
  const unplaced: UnplacedRecord[] = [];
  let leadsWithout = 0;
  let contactsWithout = 0;
  let biensWithout = 0;
  let notesWithout = 0;

  for (const lead of ownLeads) {
    const point = leadToMapPoint(lead);
    if (!point) {
      leadsWithout += 1;
      unplaced.push({
        kind: 'lead',
        recordId: lead.id,
        title: lead.address,
        href: `/dashboard/prospection?lead=${lead.id}`,
        geocodeQuery: [lead.address, lead.postalCode, lead.city].filter(Boolean).join(' ') || null,
        postalCode: lead.postalCode,
      });
      continue;
    }
    points.push(point);
  }

  for (const contact of ownContacts) {
    const point = contactToMapPoint(contact);
    if (!point) {
      contactsWithout += 1;
      unplaced.push({
        kind: 'contact',
        recordId: contact.id,
        title: contact.fullName,
        href: `/dashboard/contacts?fiche=${contact.id}`,
        geocodeQuery: (contact.address ?? contact.secteur ?? '').trim() || null,
        postalCode: postalFromList(contact.postalCodes),
      });
      continue;
    }
    points.push(point);
  }

  for (const bien of ownBiens) {
    const point = bienToMapPoint(bien);
    if (!point) {
      biensWithout += 1;
      unplaced.push({
        kind: 'bien',
        recordId: bien.id,
        title: bien.address,
        href: `/dashboard/biens?fiche=${bien.id}`,
        geocodeQuery:
          [bien.address, bien.postalCode, bien.city].filter(Boolean).join(' ').trim() || null,
        postalCode: bien.postalCode,
      });
      continue;
    }
    points.push(point);
  }

  for (const note of ownNotes) {
    const point = noteToBuildingPoint(note);
    if (!point) {
      notesWithout += 1;
      unplaced.push({
        kind: 'note',
        recordId: note.id,
        title: noteTitle(note),
        href: '/dashboard',
        geocodeQuery: (note.adresseNormalisee ?? '').trim() || null,
        postalCode: note.postalCode ?? null,
      });
      continue;
    }
    points.push(point);
  }

  return {
    points,
    withoutPosition: {
      leads: leadsWithout,
      contacts: contactsWithout,
      biens: biensWithout,
      notes: notesWithout,
    },
    unplaced,
  };
}

export function postalCodesFromPoints(
  agencyCodes: readonly string[],
  points: readonly MapPoint[],
): string[] {
  const set = new Set<string>();
  for (const code of agencyCodes) {
    const trimmed = code.trim();
    if (/^\d{5}$/.test(trimmed)) set.add(trimmed);
  }
  for (const point of points) {
    if (point.postalCode && /^\d{5}$/.test(point.postalCode)) set.add(point.postalCode);
  }
  return [...set].sort();
}

export function withoutPositionTotal(count: WithoutPositionCount): number {
  return count.leads + count.contacts + count.biens + count.notes;
}
