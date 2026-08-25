/**
 * Collecte des lignes réellement présentes en base. Aucun appel modèle.
 * Toutes les lectures sont bornées à l'agence de session, puis à la
 * visibilité du demandeur. Requêtes paramétrées uniquement.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { RecordViewer } from '@/lib/agency/visibility';
import { canSeeLeadRecord, canSeeOwnedRecord } from '@/lib/agency/visibility';
import { canSeeVoiceNote } from '@/lib/notes/visibility';
import { geocodeAdresse, type BanGeocodeHit } from '@/lib/geo/ban';
import { rapprocherAcquereurs, type RapprochableBien } from '@/lib/matching/rapprochement';
import { mapDbBienToBien } from '@/lib/queries/biens';
import {
  mapDbContactToContact,
  mapDbInteraction,
  mapDbVoiceNote,
} from '@/lib/queries/contacts';
import { normalizeSignals } from '@/lib/queries/leads';
import type { Contact, SearchCriteria } from '@/types/contact';
import type {
  BienRow,
  ContactInteractionRow,
  ContactRow,
  Database,
  LeadRow,
  VoiceNoteRow,
} from '@/types/database';
import type { AssistantIntent, IntentType } from './intent';
import { labelCherche } from './intent';
import { adresseCorrespond, escapeIlike, nomCorrespond, searchPatterns } from './normalize';

type Client = SupabaseClient<Database>;

export const COLLECTE_LIMITE = 200;

export type SourceKind = 'lead' | 'contact' | 'bien' | 'note' | 'interaction';

export type AssistantSource = {
  kind: SourceKind;
  id: string;
  typeLabel: string;
  titre: string;
  date: string | null;
  auteur: string | null;
  href: string | null;
};

export type CollecteLigne = {
  kind: SourceKind;
  id: string;
  date: string | null;
  auteur: string | null;
  faits: Record<string, unknown>;
};

export type CollecteAgregats = {
  periode_jours: number;
  contacts_crees: number;
  echanges: number;
  notes_vocales: number;
  biens_crees: number;
  leads_detectes: number;
};

export type CollecteResult = {
  type: IntentType;
  cherche: string;
  banId: string | null;
  rechercheParTexte: boolean;
  lignes: CollecteLigne[];
  sources: AssistantSource[];
  agregats: CollecteAgregats | null;
};

export type CollecteLead = {
  id: string;
  agencyId: string;
  banId: string | null;
  address: string;
  adresseNormalisee: string | null;
  postalCode: string | null;
  city: string | null;
  score: number;
  signalLabels: string[];
  marcheStatut: string | null;
  deliveredAt: string | null;
  createdAt: string;
  assignedTo: string | null;
};

export type CollecteContact = {
  id: string;
  agencyId: string;
  banId: string | null;
  address: string | null;
  fullName: string;
  firstName: string;
  lastName: string;
  type: string;
  phone: string | null;
  source: string;
  createdAt: string;
  assignedTo: string | null;
  createdBy: string | null;
  leadId: string | null;
  criteria: SearchCriteria;
};

export type CollecteInteraction = {
  id: string;
  agencyId: string;
  contactId: string;
  occurredAt: string;
  kind: string;
  body: string;
  authorId: string | null;
  assignedTo: string | null;
};

export type CollecteBien = {
  id: string;
  agencyId: string;
  banId: string | null;
  address: string;
  city: string | null;
  postalCode: string | null;
  price: number | null;
  surfaceM2: number | null;
  rooms: number | null;
  mandatStatut: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  proprietaireContactId: string | null;
};

export type CollecteNote = {
  id: string;
  agencyId: string;
  banId: string | null;
  adresseNormalisee: string | null;
  createdAt: string;
  createdBy: string | null;
  assignedTo: string | null;
  transcript: string | null;
  contactId: string | null;
  visibilite?: 'agence' | 'privee';
};

export type AgencySnapshot = {
  leads: CollecteLead[];
  contacts: CollecteContact[];
  interactions: CollecteInteraction[];
  biens: CollecteBien[];
  notes: CollecteNote[];
};

export type CollecteSnapshotCtx = {
  agencyId: string;
  viewer: RecordViewer;
  auteurNoms?: ReadonlyMap<string, string>;
  now?: Date;
  banId?: string | null;
  rechercheParTexte?: boolean;
};

const SOURCE_TYPE: Record<SourceKind, string> = {
  lead: 'Prospect',
  contact: 'Contact',
  bien: 'Bien',
  note: 'Note vocale',
  interaction: 'Échange',
};

function cap<T>(rows: T[], limit = COLLECTE_LIMITE): T[] {
  return rows.slice(0, limit);
}

function byDateDesc<T>(rows: T[], dateOf: (row: T) => string | null): T[] {
  return [...rows].sort((a, b) => {
    const da = dateOf(a) ?? '';
    const db = dateOf(b) ?? '';
    return db.localeCompare(da);
  });
}

export function scopeByAgency<T extends { agencyId: string }>(
  rows: readonly T[],
  agencyId: string,
): T[] {
  return rows.filter((r) => r.agencyId === agencyId);
}

function visLeads(viewer: RecordViewer, rows: CollecteLead[]): CollecteLead[] {
  return rows.filter((l) => canSeeLeadRecord(viewer, { assignedTo: l.assignedTo }));
}

function visContacts(viewer: RecordViewer, rows: CollecteContact[]): CollecteContact[] {
  return rows.filter((c) =>
    canSeeOwnedRecord(viewer, { assignedTo: c.assignedTo, createdBy: c.createdBy }),
  );
}

function visBiens(viewer: RecordViewer, rows: CollecteBien[]): CollecteBien[] {
  return rows.filter((b) => canSeeOwnedRecord(viewer, { assignedTo: null, createdBy: b.createdBy }));
}

function visNotes(viewer: RecordViewer, rows: CollecteNote[]): CollecteNote[] {
  return rows.filter((n) =>
    canSeeVoiceNote(viewer, {
      visibilite: n.visibilite ?? 'agence',
      createdBy: n.createdBy,
    }),
  );
}

function nomAuteur(id: string | null | undefined, noms?: ReadonlyMap<string, string>): string | null {
  if (!id || !noms) return null;
  return noms.get(id) ?? null;
}

function pickFaits(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

function hrefLead(id: string): string {
  return `/dashboard/prospection?lead=${encodeURIComponent(id)}`;
}
function hrefContact(id: string): string {
  return `/dashboard/contacts?fiche=${encodeURIComponent(id)}`;
}
function hrefBien(id: string): string {
  return `/dashboard/biens?fiche=${encodeURIComponent(id)}`;
}
function hrefNote(note: CollecteNote): string | null {
  if (note.contactId) return hrefContact(note.contactId);
  return '/dashboard/carte';
}

function visibleInteractions(
  viewer: RecordViewer,
  rows: CollecteInteraction[],
): CollecteInteraction[] {
  return rows.filter((r) =>
    canSeeOwnedRecord(viewer, { assignedTo: r.assignedTo, createdBy: r.authorId }),
  );
}

function emptyResult(intent: AssistantIntent, extra?: Partial<CollecteResult>): CollecteResult {
  return {
    type: intent.type,
    cherche: labelCherche(intent),
    banId: extra?.banId ?? null,
    rechercheParTexte: extra?.rechercheParTexte ?? false,
    lignes: [],
    sources: [],
    agregats: extra?.agregats ?? null,
  };
}

function pushLead(
  acc: { lignes: CollecteLigne[]; sources: AssistantSource[] },
  lead: CollecteLead,
  noms?: ReadonlyMap<string, string>,
): void {
  acc.lignes.push({
    kind: 'lead',
    id: lead.id,
    date: lead.deliveredAt ?? lead.createdAt,
    auteur: nomAuteur(lead.assignedTo, noms),
    faits: pickFaits({
      adresse: lead.address,
      score: lead.score,
      composantes_score: lead.signalLabels,
      statut_marche: lead.marcheStatut,
      date_detection: lead.deliveredAt ?? lead.createdAt,
    }),
  });
  acc.sources.push({
    kind: 'lead',
    id: lead.id,
    typeLabel: SOURCE_TYPE.lead,
    titre: lead.address,
    date: lead.deliveredAt ?? lead.createdAt,
    auteur: nomAuteur(lead.assignedTo, noms),
    href: hrefLead(lead.id),
  });
}

function pushContact(
  acc: { lignes: CollecteLigne[]; sources: AssistantSource[] },
  c: CollecteContact,
  noms?: ReadonlyMap<string, string>,
  extraFaits?: Record<string, unknown>,
): void {
  const criteres =
    c.type === 'acquereur'
      ? pickFaits({
          budget_min: c.criteria.budgetMin,
          budget_max: c.criteria.budgetMax,
          surface_min: c.criteria.surfaceMin,
          surface_max: c.criteria.surfaceMax,
          pieces_min: c.criteria.roomsMin,
          codes_postaux: c.criteria.postalCodes,
        })
      : {};
  acc.lignes.push({
    kind: 'contact',
    id: c.id,
    date: c.createdAt,
    auteur: nomAuteur(c.createdBy, noms),
    faits: pickFaits({
      nom: c.fullName,
      type: c.type,
      telephone: c.phone,
      date_creation: c.createdAt,
      source: c.source,
      adresse: c.address,
      ...criteres,
      ...extraFaits,
    }),
  });
  acc.sources.push({
    kind: 'contact',
    id: c.id,
    typeLabel: SOURCE_TYPE.contact,
    titre: c.fullName,
    date: c.createdAt,
    auteur: nomAuteur(c.createdBy, noms),
    href: hrefContact(c.id),
  });
}

function pushInteraction(
  acc: { lignes: CollecteLigne[]; sources: AssistantSource[] },
  it: CollecteInteraction,
  contactName: string | null,
  noms?: ReadonlyMap<string, string>,
): void {
  acc.lignes.push({
    kind: 'interaction',
    id: it.id,
    date: it.occurredAt,
    auteur: nomAuteur(it.authorId, noms),
    faits: pickFaits({
      date: it.occurredAt,
      canal: it.kind,
      contenu: it.body,
      contact: contactName,
    }),
  });
  acc.sources.push({
    kind: 'interaction',
    id: it.id,
    typeLabel: SOURCE_TYPE.interaction,
    titre: contactName ? `${contactName} — ${it.kind}` : it.kind,
    date: it.occurredAt,
    auteur: nomAuteur(it.authorId, noms),
    href: hrefContact(it.contactId),
  });
}

function pushBien(
  acc: { lignes: CollecteLigne[]; sources: AssistantSource[] },
  b: CollecteBien,
  noms?: ReadonlyMap<string, string>,
  proprietaire?: string | null,
): void {
  acc.lignes.push({
    kind: 'bien',
    id: b.id,
    date: b.updatedAt ?? b.createdAt,
    auteur: nomAuteur(b.createdBy, noms),
    faits: pickFaits({
      adresse: b.address,
      prix: b.price,
      surface: b.surfaceM2,
      pieces: b.rooms,
      statut_mandat: b.mandatStatut,
      proprietaire,
      date_creation: b.createdAt,
      date_maj: b.updatedAt,
    }),
  });
  acc.sources.push({
    kind: 'bien',
    id: b.id,
    typeLabel: SOURCE_TYPE.bien,
    titre: b.address,
    date: b.updatedAt ?? b.createdAt,
    auteur: nomAuteur(b.createdBy, noms),
    href: hrefBien(b.id),
  });
}

function pushNote(
  acc: { lignes: CollecteLigne[]; sources: AssistantSource[] },
  n: CollecteNote,
  noms?: ReadonlyMap<string, string>,
): void {
  acc.lignes.push({
    kind: 'note',
    id: n.id,
    date: n.createdAt,
    auteur: nomAuteur(n.createdBy, noms),
    faits: pickFaits({
      date: n.createdAt,
      auteur: nomAuteur(n.createdBy, noms),
      transcription: n.transcript,
      adresse: n.adresseNormalisee,
    }),
  });
  acc.sources.push({
    kind: 'note',
    id: n.id,
    typeLabel: SOURCE_TYPE.note,
    titre: n.adresseNormalisee || 'Note vocale',
    date: n.createdAt,
    auteur: nomAuteur(n.createdBy, noms),
    href: hrefNote(n),
  });
}

function matchImmeuble(
  banId: string | null,
  texte: string | null,
  recordBanId: string | null,
  ...addressFields: Array<string | null | undefined>
): boolean {
  if (banId && recordBanId === banId) return true;
  if (texte) return adresseCorrespond(texte, ...addressFields);
  return false;
}

function onImmeuble(
  lead: CollecteLead,
  banId: string | null,
  texte: string | null,
): boolean {
  return matchImmeuble(banId, texte, lead.banId, lead.address, lead.adresseNormalisee, lead.city, lead.postalCode);
}

function contactOnImmeuble(
  c: CollecteContact,
  banId: string | null,
  texte: string | null,
): boolean {
  return matchImmeuble(banId, texte, c.banId, c.address);
}

function bienOnImmeuble(
  b: CollecteBien,
  banId: string | null,
  texte: string | null,
): boolean {
  return matchImmeuble(banId, texte, b.banId, b.address, b.city, b.postalCode);
}

function noteOnImmeuble(
  n: CollecteNote,
  banId: string | null,
  texte: string | null,
): boolean {
  return matchImmeuble(banId, texte, n.banId, n.adresseNormalisee);
}

function collectImmeuble(
  intent: AssistantIntent,
  snap: AgencySnapshot,
  ctx: CollecteSnapshotCtx,
): CollecteResult {
  const banId = ctx.banId ?? null;
  const parTexte = ctx.rechercheParTexte === true;
  const texte = intent.adresse;
  if (!banId && !texte) return emptyResult(intent, { rechercheParTexte: parTexte });

  const leads = cap(
    byDateDesc(
      visLeads(
        ctx.viewer,
        snap.leads.filter((l) => onImmeuble(l, banId, texte)),
      ),
      (l) => l.deliveredAt ?? l.createdAt,
    ),
  );

  const contacts = cap(
    byDateDesc(
      visContacts(
        ctx.viewer,
        snap.contacts.filter((c) => contactOnImmeuble(c, banId, texte)),
      ),
      (c) => c.createdAt,
    ),
  );
  const contactIds = new Set(contacts.map((c) => c.id));

  const biens = cap(
    byDateDesc(
      visBiens(
        ctx.viewer,
        snap.biens.filter((b) => bienOnImmeuble(b, banId, texte)),
      ),
      (b) => b.updatedAt ?? b.createdAt,
    ),
  );

  const ownerIds = new Set(
    biens.map((b) => b.proprietaireContactId).filter((id): id is string => Boolean(id)),
  );
  const extraOwners = visContacts(
    ctx.viewer,
    snap.contacts.filter((c) => ownerIds.has(c.id) && !contactIds.has(c.id)),
  );
  for (const owner of extraOwners) {
    contacts.push(owner);
    contactIds.add(owner.id);
  }
  const contactName = (id: string) => contacts.find((c) => c.id === id)?.fullName ?? null;

  const interactions = cap(
    byDateDesc(
      visibleInteractions(
        ctx.viewer,
        snap.interactions.filter((i) => contactIds.has(i.contactId)),
      ),
      (i) => i.occurredAt,
    ),
  );

  const notes = cap(
    byDateDesc(
      visNotes(
        ctx.viewer,
        snap.notes.filter((n) => noteOnImmeuble(n, banId, texte)),
      ),
      (n) => n.createdAt,
    ),
  );

  const acc = { lignes: [] as CollecteLigne[], sources: [] as AssistantSource[] };
  for (const l of leads) pushLead(acc, l, ctx.auteurNoms);
  for (const c of contacts) pushContact(acc, c, ctx.auteurNoms);
  for (const i of interactions) pushInteraction(acc, i, contactName(i.contactId), ctx.auteurNoms);
  for (const b of biens) {
    pushBien(acc, b, ctx.auteurNoms, b.proprietaireContactId ? contactName(b.proprietaireContactId) : null);
  }
  for (const n of notes) pushNote(acc, n, ctx.auteurNoms);

  return {
    type: 'immeuble',
    cherche: labelCherche(intent),
    banId,
    rechercheParTexte: parTexte,
    lignes: acc.lignes,
    sources: acc.sources,
    agregats: null,
  };
}

function collectPersonne(
  intent: AssistantIntent,
  snap: AgencySnapshot,
  ctx: CollecteSnapshotCtx,
): CollecteResult {
  const nom = intent.nom?.trim() ?? '';
  if (nom.length < 2) return emptyResult(intent);

  const contacts = cap(
    byDateDesc(
      visContacts(
        ctx.viewer,
        snap.contacts.filter((c) => nomCorrespond(nom, c.fullName, c.firstName, c.lastName)),
      ),
      (c) => c.createdAt,
    ),
  );
  const ids = new Set(contacts.map((c) => c.id));
  const leadIds = new Set(contacts.map((c) => c.leadId).filter((id): id is string => Boolean(id)));

  const interactions = cap(
    byDateDesc(
      visibleInteractions(
        ctx.viewer,
        snap.interactions.filter((i) => ids.has(i.contactId)),
      ),
      (i) => i.occurredAt,
    ),
  );

  const biens = cap(
    byDateDesc(
      visBiens(
        ctx.viewer,
        snap.biens.filter((b) => b.proprietaireContactId !== null && ids.has(b.proprietaireContactId)),
      ),
      (b) => b.updatedAt ?? b.createdAt,
    ),
  );

  const notes = cap(
    byDateDesc(
      visNotes(
        ctx.viewer,
        snap.notes.filter((n) => n.contactId !== null && ids.has(n.contactId)),
      ),
      (n) => n.createdAt,
    ),
  );

  const leads = cap(
    byDateDesc(
      visLeads(
        ctx.viewer,
        snap.leads.filter((l) => leadIds.has(l.id)),
      ),
      (l) => l.deliveredAt ?? l.createdAt,
    ),
  );

  const acc = { lignes: [] as CollecteLigne[], sources: [] as AssistantSource[] };
  for (const c of contacts) pushContact(acc, c, ctx.auteurNoms);
  for (const i of interactions) {
    pushInteraction(acc, i, contacts.find((c) => c.id === i.contactId)?.fullName ?? null, ctx.auteurNoms);
  }
  for (const b of biens) pushBien(acc, b, ctx.auteurNoms);
  for (const n of notes) pushNote(acc, n, ctx.auteurNoms);
  for (const l of leads) pushLead(acc, l, ctx.auteurNoms);

  return {
    type: 'personne',
    cherche: labelCherche(intent),
    banId: null,
    rechercheParTexte: false,
    lignes: acc.lignes,
    sources: acc.sources,
    agregats: null,
  };
}

function toRapprochable(b: CollecteBien): RapprochableBien {
  return {
    id: b.id,
    address: b.address,
    postalCode: b.postalCode,
    price: b.price,
    surfaceM2: b.surfaceM2,
    rooms: b.rooms,
  };
}

function collectAcquereurs(
  intent: AssistantIntent,
  snap: AgencySnapshot,
  ctx: CollecteSnapshotCtx,
): CollecteResult {
  const typeFiltre = intent.filtres.type_contact ?? 'acquereur';
  const contacts = visContacts(
    ctx.viewer,
    snap.contacts.filter((c) => c.type === typeFiltre),
  );

  const biensVisibles = visBiens(ctx.viewer, snap.biens).filter((b) => {
    if (intent.filtres.statut_mandat && b.mandatStatut !== intent.filtres.statut_mandat) return false;
    return true;
  });

  const banId = ctx.banId ?? null;
  const parTexte = ctx.rechercheParTexte === true;
  const texte = intent.adresse;

  let cible: RapprochableBien | null = null;
  if (banId || texte) {
    const match = biensVisibles.find((b) => bienOnImmeuble(b, banId, texte));
    if (match) cible = toRapprochable(match);
  }

  if (!cible) {
    const cp = intent.code_postal;
    if (cp || texte) {
      cible = {
        id: 'virtuel',
        address: texte ?? '',
        postalCode: cp,
        price: null,
        surfaceM2: null,
        rooms: null,
      };
    }
  }

  if (!cible) return emptyResult(intent, { banId, rechercheParTexte: parTexte });

  const domainContacts: Contact[] = contacts.map((c) => ({
    id: c.id,
    agencyId: c.agencyId,
    createdBy: c.createdBy,
    firstName: c.firstName,
    lastName: c.lastName,
    fullName: c.fullName,
    type: (c.type === 'acquereur' || c.type === 'vendeur' || c.type === 'locataire' || c.type === 'autre'
      ? c.type
      : 'autre'),
    phone: c.phone,
    email: null,
    secteur: null,
    criteria: c.criteria,
    summary: null,
    lastInteractionAt: null,
    source: (c.source === 'manuel' || c.source === 'vocal' || c.source === 'prospection'
      ? c.source
      : 'manuel'),
    address: c.address,
    banId: c.banId,
    latitude: null,
    longitude: null,
    leadId: c.leadId,
    assignedTo: c.assignedTo,
    assignedBy: null,
    assignedAt: null,
    createdAt: c.createdAt,
    updatedAt: c.createdAt,
  }));

  const matches = rapprocherAcquereurs(cible, domainContacts);
  const byId = new Map(contacts.map((c) => [c.id, c]));
  const acc = { lignes: [] as CollecteLigne[], sources: [] as AssistantSource[] };

  for (const m of matches) {
    const c = byId.get(m.contact.id);
    if (!c) continue;
    pushContact(acc, c, ctx.auteurNoms, {
      score_correspondance: m.score,
      raisons: m.raisons,
    });
  }

  return {
    type: 'recherche_acquereur',
    cherche: labelCherche(intent),
    banId,
    rechercheParTexte: parTexte,
    lignes: acc.lignes,
    sources: acc.sources,
    agregats: null,
  };
}

function sinceIso(now: Date, jours: number): string {
  return new Date(now.getTime() - jours * 86_400_000).toISOString();
}

function collectActivite(
  intent: AssistantIntent,
  snap: AgencySnapshot,
  ctx: CollecteSnapshotCtx,
): CollecteResult {
  const jours = intent.periode_jours ?? 7;
  const since = sinceIso(ctx.now ?? new Date(), jours);
  /** « Aujourd’hui / que faire » : la pile actuelle, pas les dictées d’anciennes fiches. */
  const pileDuJour = jours <= 1;

  const contacts = cap(
    byDateDesc(
      visContacts(
        ctx.viewer,
        pileDuJour ? snap.contacts : snap.contacts.filter((c) => c.createdAt >= since),
      ),
      (c) => c.createdAt,
    ),
  );
  const contactIds = new Set(contacts.map((c) => c.id));

  const interactions = cap(
    byDateDesc(
      visibleInteractions(
        ctx.viewer,
        snap.interactions.filter(
          (i) => contactIds.has(i.contactId) && (pileDuJour || i.occurredAt >= since),
        ),
      ),
      (i) => i.occurredAt,
    ),
  );

  const biens = cap(
    byDateDesc(
      visBiens(
        ctx.viewer,
        pileDuJour ? snap.biens : snap.biens.filter((b) => b.createdAt >= since),
      ),
      (b) => b.createdAt,
    ),
  );
  const leads = cap(
    byDateDesc(
      visLeads(
        ctx.viewer,
        pileDuJour ? snap.leads : snap.leads.filter((l) => l.createdAt >= since),
      ),
      (l) => l.deliveredAt ?? l.createdAt,
    ),
  );

  const notesLiees = visNotes(
    ctx.viewer,
    snap.notes.filter((n) => n.contactId !== null && contactIds.has(n.contactId)),
  );

  const agregats: CollecteAgregats = {
    periode_jours: jours,
    contacts_crees: pileDuJour
      ? contacts.length
      : contacts.filter((c) => c.createdAt >= since).length,
    echanges: interactions.length,
    notes_vocales: notesLiees.filter((n) => n.createdAt >= since).length,
    biens_crees: pileDuJour ? biens.length : biens.filter((b) => b.createdAt >= since).length,
    leads_detectes: pileDuJour ? leads.length : leads.filter((l) => l.createdAt >= since).length,
  };

  const acc = { lignes: [] as CollecteLigne[], sources: [] as AssistantSource[] };
  const contactName = (id: string) => contacts.find((c) => c.id === id)?.fullName ?? null;
  for (const c of contacts) pushContact(acc, c, ctx.auteurNoms);
  for (const i of interactions) pushInteraction(acc, i, contactName(i.contactId), ctx.auteurNoms);
  for (const b of biens) pushBien(acc, b, ctx.auteurNoms);
  for (const l of leads) pushLead(acc, l, ctx.auteurNoms);

  return {
    type: 'activite',
    cherche: labelCherche(intent),
    banId: null,
    rechercheParTexte: false,
    lignes: acc.lignes,
    sources: acc.sources,
    agregats,
  };
}

/**
 * Cœur testable : un instantané déjà lu, filtré par agency_id puis visibilité.
 * Un agency_id étranger dans l'instantané est écarté — jamais renvoyé.
 */
export function collectFromSnapshot(
  intent: AssistantIntent,
  snapshot: AgencySnapshot,
  ctx: CollecteSnapshotCtx,
): CollecteResult {
  const snap: AgencySnapshot = {
    leads: scopeByAgency(snapshot.leads, ctx.agencyId),
    contacts: scopeByAgency(snapshot.contacts, ctx.agencyId),
    interactions: scopeByAgency(snapshot.interactions, ctx.agencyId),
    biens: scopeByAgency(snapshot.biens, ctx.agencyId),
    notes: scopeByAgency(snapshot.notes, ctx.agencyId),
  };

  if (intent.type === 'inconnu') return emptyResult(intent);
  if (intent.type === 'immeuble') return collectImmeuble(intent, snap, ctx);
  if (intent.type === 'personne') return collectPersonne(intent, snap, ctx);
  if (intent.type === 'recherche_acquereur') return collectAcquereurs(intent, snap, ctx);
  return collectActivite(intent, snap, ctx);
}

function mapLeadRow(row: LeadRow): CollecteLead {
  const extra = row as LeadRow & { adresse_normalisee?: string | null };
  const { signals } = normalizeSignals(row.signals);
  return {
    id: row.id,
    agencyId: row.agency_id,
    banId: row.ban_id ?? null,
    address: row.address,
    adresseNormalisee: extra.adresse_normalisee ?? null,
    postalCode: row.postal_code,
    city: row.city,
    score: row.score,
    signalLabels: signals.map((s) => s.label).filter(Boolean),
    marcheStatut: row.marche_statut ?? null,
    deliveredAt: row.delivered_at ?? row.created_at.slice(0, 10),
    createdAt: row.created_at,
    assignedTo: row.assigned_to,
  };
}

function mapContactRow(row: ContactRow): CollecteContact {
  const c = mapDbContactToContact(row);
  return {
    id: c.id,
    agencyId: c.agencyId,
    banId: c.banId,
    address: c.address,
    fullName: c.fullName,
    firstName: c.firstName,
    lastName: c.lastName,
    type: c.type,
    phone: c.phone,
    source: c.source,
    createdAt: c.createdAt,
    assignedTo: c.assignedTo,
    createdBy: c.createdBy,
    leadId: c.leadId,
    criteria: c.criteria,
  };
}

function mapBienRow(row: BienRow): CollecteBien {
  const b = mapDbBienToBien(row);
  return {
    id: b.id,
    agencyId: b.agencyId,
    banId: b.banId,
    address: b.address,
    city: b.city,
    postalCode: b.postalCode,
    price: b.price,
    surfaceM2: b.surfaceM2,
    rooms: b.rooms,
    mandatStatut: b.mandatStatut,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    createdBy: b.createdBy,
    proprietaireContactId: b.proprietaireContactId,
  };
}

async function fetchLimited<T>(
  query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const { data, error } = await query;
  if (error) {
    console.error('[assistant] lecture', error.message);
    return [];
  }
  return data ?? [];
}

export type CollecteLiveCtx = {
  agencyId: string;
  viewer: RecordViewer;
  auteurNoms: ReadonlyMap<string, string>;
  now?: Date;
  geocode?: (adresse: string, codePostal?: string) => Promise<BanGeocodeHit | null>;
};

async function resolveImmeubleGeo(
  intent: AssistantIntent,
  geo: CollecteLiveCtx['geocode'],
): Promise<{ banId: string | null; rechercheParTexte: boolean }> {
  const adresse = intent.adresse?.trim() ?? '';
  if (adresse.length < 3) return { banId: null, rechercheParTexte: false };
  const geocode = geo ?? geocodeAdresse;
  const hit = await geocode(adresse, intent.code_postal ?? undefined);
  if (hit?.ban_id) return { banId: hit.ban_id, rechercheParTexte: false };
  return { banId: null, rechercheParTexte: true };
}

async function loadSnapshot(
  supabase: Client,
  agencyId: string,
  opts: {
    banId?: string | null;
    adresseTexte?: string | null;
    nom?: string | null;
    since?: string | null;
    loadAllVisible?: boolean;
  },
): Promise<AgencySnapshot> {
  const addressPatterns = opts.adresseTexte ? searchPatterns(opts.adresseTexte) : [];
  const nomLike = opts.nom ? `%${escapeIlike(opts.nom)}%` : null;

  function addressOr(fields: readonly string[]): string | null {
    const parts: string[] = [];
    if (opts.banId) parts.push(`ban_id.eq."${opts.banId}"`);
    for (const p of addressPatterns) {
      const like = `%${escapeIlike(p)}%`;
      for (const f of fields) parts.push(`${f}.ilike."${like}"`);
    }
    return parts.length > 0 ? parts.join(',') : null;
  }

  const leadQ = supabase
    .from('leads')
    .select(
      'id, agency_id, address, city, postal_code, score, signals, marche_statut, delivered_at, created_at, assigned_to, ban_id, adresse_normalisee, status, owner_type, property_type, surface_m2, display_signals',
    )
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })
    .limit(COLLECTE_LIMITE);

  const contactQ = supabase
    .from('contacts')
    .select(
      'id, agency_id, created_by, first_name, last_name, contact_type, phone, email, secteur, postal_codes, budget_min, budget_max, surface_min, surface_max, rooms_min, summary, last_interaction_at, source, lead_id, address, ban_id, assigned_to, created_at, updated_at',
    )
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })
    .limit(COLLECTE_LIMITE);

  const bienQ = supabase
    .from('biens')
    .select(
      'id, agency_id, created_by, address, city, postal_code, price, surface_m2, rooms, mandat_statut, proprietaire_contact_id, ban_id, created_at, updated_at, property_type, notes, lead_id',
    )
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })
    .limit(COLLECTE_LIMITE);

  const noteQ = supabase
    .from('voice_notes')
    .select(
      'id, agency_id, created_by, transcript, status, contact_id, ban_id, adresse_normalisee, assigned_to, created_at, storage_path, duration_seconds, mime_type, structured, updated_at, visibilite, source_info, statut',
    )
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })
    .limit(COLLECTE_LIMITE);

  if (!opts.loadAllVisible) {
    const leadOr = addressOr(['address', 'adresse_normalisee']);
    const contactOr = addressOr(['address']);
    const bienOr = addressOr(['address']);
    const noteOr = addressOr(['adresse_normalisee', 'transcript']);
    if (leadOr) leadQ.or(leadOr);
    if (contactOr) contactQ.or(contactOr);
    if (bienOr) bienQ.or(bienOr);
    if (noteOr) noteQ.or(noteOr);
  }

  if (nomLike) {
    contactQ.or(`first_name.ilike."${nomLike}",last_name.ilike."${nomLike}"`);
  }

  if (opts.since) {
    contactQ.gte('created_at', opts.since);
    bienQ.gte('created_at', opts.since);
    noteQ.gte('created_at', opts.since);
    leadQ.gte('created_at', opts.since);
  }

  const [leadRows, contactRows, bienRows, noteRows] = await Promise.all([
    fetchLimited(leadQ),
    fetchLimited(contactQ),
    fetchLimited(bienQ),
    fetchLimited(noteQ),
  ]);

  const contacts = (contactRows as unknown as ContactRow[]).map(mapContactRow);
  const biens = (bienRows as unknown as BienRow[]).map(mapBienRow);
  const knownContactIds = new Set(contacts.map((c) => c.id));
  const missingOwnerIds = [
    ...new Set(
      biens
        .map((b) => b.proprietaireContactId)
        .filter((id): id is string => Boolean(id) && !knownContactIds.has(id)),
    ),
  ];
  if (missingOwnerIds.length > 0) {
    const extraRows = await fetchLimited(
      supabase
        .from('contacts')
        .select(
          'id, agency_id, created_by, first_name, last_name, contact_type, phone, email, secteur, postal_codes, budget_min, budget_max, surface_min, surface_max, rooms_min, summary, last_interaction_at, source, lead_id, address, ban_id, assigned_to, created_at, updated_at',
        )
        .eq('agency_id', agencyId)
        .in('id', missingOwnerIds),
    );
    contacts.push(...(extraRows as unknown as ContactRow[]).map(mapContactRow));
  }
  const contactIds = contacts.map((c) => c.id);

  let interactions: CollecteInteraction[] = [];
  if (contactIds.length > 0 || opts.loadAllVisible || opts.since) {
    let iq = supabase
      .from('contact_interactions')
      .select(
        'id, agency_id, contact_id, author_id, kind, body, voice_note_id, assigned_to, occurred_at, created_at',
      )
      .eq('agency_id', agencyId)
      .order('occurred_at', { ascending: false })
      .limit(COLLECTE_LIMITE);
    if (contactIds.length > 0 && !opts.loadAllVisible && !opts.since) {
      iq = iq.in('contact_id', contactIds);
    }
    if (opts.since) iq = iq.gte('occurred_at', opts.since);
    const rows = await fetchLimited(iq);
    interactions = (rows as unknown as ContactInteractionRow[]).map((row) => {
      const it = mapDbInteraction(row);
      return {
        id: it.id,
        agencyId: row.agency_id,
        contactId: it.contactId,
        occurredAt: it.occurredAt,
        kind: it.kind,
        body: it.body,
        authorId: it.authorId,
        assignedTo: it.assignedTo,
      };
    });
  }

  return {
    leads: (leadRows as unknown as LeadRow[]).map(mapLeadRow),
    contacts,
    interactions,
    biens,
    notes: (noteRows as unknown as VoiceNoteRow[]).map((row) => {
      const n = mapDbVoiceNote(row);
      return {
        id: n.id,
        agencyId: n.agencyId,
        banId: n.banId,
        adresseNormalisee: n.adresseNormalisee,
        createdAt: n.createdAt,
        createdBy: n.createdBy,
        assignedTo: n.assignedTo,
        transcript: n.transcript,
        contactId: n.contactId,
        visibilite: n.visibilite,
      };
    }),
  };
}

/** Collecte live : agency_id = session, jamais un identifiant fourni par le client. */
export async function collecter(
  intent: AssistantIntent,
  supabase: Client,
  ctx: CollecteLiveCtx,
): Promise<CollecteResult> {
  if (intent.type === 'inconnu') {
    return emptyResult(intent);
  }

  let banId: string | null = null;
  let rechercheParTexte = false;

  if (intent.type === 'immeuble' || intent.type === 'recherche_acquereur') {
    const geo = await resolveImmeubleGeo(intent, ctx.geocode);
    banId = geo.banId;
    rechercheParTexte = geo.rechercheParTexte;
  }

  const jours = intent.periode_jours ?? 7;
  const since = intent.type === 'activite' ? sinceIso(ctx.now ?? new Date(), jours) : null;

  const snapshot = await loadSnapshot(supabase, ctx.agencyId, {
    banId: banId && !rechercheParTexte ? banId : null,
    adresseTexte:
      intent.type === 'immeuble' || intent.type === 'recherche_acquereur' ? intent.adresse : null,
    nom: intent.type === 'personne' ? intent.nom : null,
    since,
    loadAllVisible: intent.type === 'recherche_acquereur' || intent.type === 'activite',
  });

  return collectFromSnapshot(intent, snapshot, {
    agencyId: ctx.agencyId,
    viewer: ctx.viewer,
    auteurNoms: ctx.auteurNoms,
    now: ctx.now,
    banId,
    rechercheParTexte,
  });
}

export function payloadPourModele(result: CollecteResult): Record<string, unknown> {
  return {
    recherche: {
      type: result.type,
      libelle: result.cherche,
      par_texte: result.rechercheParTexte,
    },
    agregats: result.agregats,
    lignes: result.lignes.map((l) => ({
      type: l.kind,
      date: l.date,
      auteur: l.auteur,
      ...l.faits,
    })),
  };
}
