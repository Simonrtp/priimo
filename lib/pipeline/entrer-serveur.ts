import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { geocodeAdresse } from '@/lib/geo/ban';
import { LEADS_CLIENT_SELECT, mapDbLeadToLead } from '@/lib/queries/leads';
import { ymdKey, parisYmd } from '@/lib/today/calendar';
import type { Database, DpeLettreDb, LeadInsert, LeadRow } from '@/types/database';
import type { BienDuPipeline, Lead } from '@/types/lead';
import { bienDepuisLigne, typeBienFiche, type LigneBienPipeline } from './bien';
import { deciderEntree } from './entrer';

type Admin = SupabaseClient<Database>;

export type DemandeEntree = {
  address: string;
  city: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  banId: string | null;
  surfaceM2: number | null;
  rooms: number | null;
  etage: string | null;
  dpeClass: string | null;
  propertyType: string | null;
  ownerType: 'particulier' | 'entreprise';
  companyName: string | null;
  notes: string | null;
  provenance: 'terrain' | 'portail';
  /** Prix affiché (annonce) ou retenu (estimation). */
  price?: number | null;
  photos?: string[];
  /** Lien de l'annonce : gardé sur la fiche bien, pas sur la carte. */
  lien?: string | null;
  /** Fiche bien déjà créée (estimation) : on la rattache au lieu d'en créer une. */
  bienId?: string | null;
  /** Étape visée (clé). Par défaut, l'étape d'entrée. Une carte ne recule jamais. */
  etape?: string | null;
};

const BIEN_PIPELINE_SELECT = 'id, lead_id, property_type, surface_m2, rooms, price, photos';

type LigneExistante = { id: string; stage_id: string | null; score: number; notes: string | null };

function enFrance(lat: number, lng: number): boolean {
  return lat >= 41 && lat <= 51.5 && lng >= -5.5 && lng <= 10;
}

async function lireLead(admin: Admin, id: string): Promise<Lead | null> {
  const { data, error } = await admin.from('leads').select(LEADS_CLIENT_SELECT).eq('id', id).maybeSingle();
  if (error || !data) return null;
  return mapDbLeadToLead(data as unknown as LeadRow);
}

function entier(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

/**
 * La fiche bien de la carte : celle désignée, celle déjà liée au lead, celle
 * de l'agence à la même adresse encore libre, sinon une nouvelle. Les champs
 * vides se complètent, rien de saisi n'est écrasé.
 */
async function rattacherBien(
  admin: Admin,
  qui: { agencyId: string; profileId: string },
  leadId: string,
  demande: DemandeEntree,
  ban: { banId: string | null; adresse: string | null },
): Promise<BienDuPipeline | null> {
  const base = () =>
    admin.from('biens').select(BIEN_PIPELINE_SELECT).eq('agency_id', qui.agencyId).limit(1);

  let existant: LigneBienPipeline | null = null;
  if (demande.bienId) {
    const { data } = await base().eq('id', demande.bienId).maybeSingle();
    existant = (data as LigneBienPipeline | null) ?? null;
  }
  if (!existant) {
    const { data } = await base().eq('lead_id', leadId).order('created_at', { ascending: false }).maybeSingle();
    existant = (data as LigneBienPipeline | null) ?? null;
  }
  if (!existant && ban.banId) {
    const { data } = await base().eq('ban_id', ban.banId).is('lead_id', null).maybeSingle();
    existant = (data as LigneBienPipeline | null) ?? null;
  }

  const photos = (demande.photos ?? []).slice(0, 12);
  const surface = entier(demande.surfaceM2);
  const pieces = entier(demande.rooms);
  const prix = entier(demande.price);
  const type = typeBienFiche(demande.propertyType);
  const dpe =
    demande.dpeClass && /^[A-G]$/.test(demande.dpeClass) ? (demande.dpeClass as DpeLettreDb) : null;

  if (existant) {
    const complement: Database['public']['Tables']['biens']['Update'] = { lead_id: leadId };
    if (existant.property_type == null && type) complement.property_type = type;
    if (existant.surface_m2 == null && surface) complement.surface_m2 = surface;
    if (existant.rooms == null && pieces) complement.rooms = pieces;
    if (existant.price == null && prix) complement.price = prix;
    if ((existant.photos ?? []).length === 0 && photos.length > 0) complement.photos = photos;
    const { data, error } = await admin
      .from('biens')
      .update(complement)
      .eq('id', existant.id)
      .eq('agency_id', qui.agencyId)
      .select(BIEN_PIPELINE_SELECT)
      .maybeSingle();
    if (error) console.error('[pipeline] bien rattaché', error.message);
    return bienDepuisLigne((data as LigneBienPipeline | null) ?? existant);
  }

  const { data, error } = await admin
    .from('biens')
    .insert({
      agency_id: qui.agencyId,
      created_by: qui.profileId,
      assigned_to: qui.profileId,
      lead_id: leadId,
      address: demande.address,
      city: demande.city,
      postal_code: demande.postalCode,
      latitude: demande.latitude,
      longitude: demande.longitude,
      ban_id: ban.banId,
      adresse_normalisee: ban.adresse,
      property_type: type,
      surface_m2: surface,
      rooms: pieces,
      price: prix,
      dpe_lettre: dpe,
      photos,
      notes: [demande.notes, demande.lien].filter(Boolean).join(' · ') || null,
      mandat_statut: 'estimation',
    })
    .select(BIEN_PIPELINE_SELECT)
    .maybeSingle();
  if (error || !data) {
    console.error('[pipeline] bien', error?.message ?? 'vide');
    return null;
  }
  return bienDepuisLigne(data as LigneBienPipeline);
}

/** L'étape visée, et celle d'entrée : la carte n'avance que si elle est en deçà. */
async function lireEtapes(
  admin: Admin,
  agencyId: string,
): Promise<{ id: string; cle: string; ordre: number; type: string }[] | null> {
  const { data, error } = await admin
    .from('lead_stages')
    .select('id, cle, ordre, type')
    .eq('agency_id', agencyId)
    .order('ordre', { ascending: true });
  if (error) {
    console.error('[pipeline] étapes', error.message);
    return null;
  }
  return (data ?? []) as { id: string; cle: string; ordre: number; type: string }[];
}

async function positionSuivante(admin: Admin, agencyId: string, stageId: string): Promise<number> {
  const { data } = await admin
    .from('leads')
    .select('stage_position')
    .eq('agency_id', agencyId)
    .eq('stage_id', stageId)
    .order('stage_position', { ascending: false })
    .limit(1);
  const max = data?.[0]?.stage_position;
  return typeof max === 'number' ? max + 1 : 1000;
}

async function resoudreBan(demande: DemandeEntree): Promise<{ banId: string | null; adresse: string | null }> {
  if (demande.banId) return { banId: demande.banId, adresse: null };
  const ligne = [demande.address, demande.postalCode, demande.city].filter(Boolean).join(' ');
  const proche =
    demande.latitude != null && demande.longitude != null
      ? { latitude: demande.latitude, longitude: demande.longitude }
      : null;
  const hit = await geocodeAdresse(ligne, demande.postalCode ?? undefined, undefined, proche);
  return { banId: hit?.ban_id ?? null, adresse: hit?.adresse_normalisee ?? null };
}

async function fichesALadresse(
  admin: Admin,
  agencyId: string,
  banId: string | null,
  demande: DemandeEntree,
): Promise<LigneExistante[]> {
  const base = admin.from('leads').select('id, stage_id, score, notes').eq('agency_id', agencyId).limit(20);
  const { data, error } = banId
    ? await base.eq('ban_id', banId)
    : demande.postalCode
      ? await base.eq('postal_code', demande.postalCode).ilike('address', demande.address)
      : { data: [], error: null };
  if (error || !data) return [];
  return (data as LigneExistante[]).map((row) => ({
    id: row.id,
    stage_id: row.stage_id ?? null,
    score: typeof row.score === 'number' ? row.score : 0,
    notes: row.notes ?? null,
  }));
}

/**
 * La seule porte du pipeline : un bien entre dans Pris (ou à l'étape visée).
 * Le lead porte l'étape, la fiche bien ce qu'on vend. Une fiche déjà livrée à
 * cette adresse est prise plutôt que dupliquée. Déjà au pipeline : on le dit,
 * sans deuxième carte.
 */
export async function entrerDansLePipeline(
  admin: Admin,
  qui: { agencyId: string; profileId: string },
  demande: DemandeEntree,
): Promise<{ etat: 'cree' | 'pris' | 'deja'; lead: Lead } | { erreur: string }> {
  if (
    demande.latitude != null &&
    demande.longitude != null &&
    !enFrance(demande.latitude, demande.longitude)
  ) {
    return { erreur: 'Adresse hors de France' };
  }

  const etapes = await lireEtapes(admin, qui.agencyId);
  if (!etapes) return { erreur: 'Impossible d’ajouter au pipeline pour le moment' };
  const entree = etapes.find((e) => e.type === 'entree');
  if (!entree) return { erreur: 'Le pipeline n’a pas encore d’étape d’entrée' };
  const visee = (demande.etape ? etapes.find((e) => e.cle === demande.etape) : undefined) ?? entree;
  const stageId = visee.id;

  const ban = await resoudreBan(demande);
  const existants = await fichesALadresse(admin, qui.agencyId, ban.banId, demande);
  const choix = deciderEntree(
    existants.map((row) => ({ ...row, stageId: row.stage_id })),
  );

  const now = new Date().toISOString();
  const position = await positionSuivante(admin, qui.agencyId, stageId);

  /** Chaque carte porte son bien : on le rattache, puis on relit la carte. */
  const finir = async (
    etat: 'cree' | 'pris' | 'deja',
    id: string,
  ): Promise<{ etat: 'cree' | 'pris' | 'deja'; lead: Lead } | { erreur: string }> => {
    const [lead, bien] = await Promise.all([
      lireLead(admin, id),
      rattacherBien(admin, qui, id, demande, ban),
    ]);
    return lead ? { etat, lead: { ...lead, bien } } : { erreur: 'Impossible d’ajouter au pipeline pour le moment' };
  };

  if (choix.action === 'deja') {
    // Déjà au pipeline : une estimation faite fait avancer la carte, jamais reculer.
    const actuelle = etapes.find((e) => e.id === choix.lead.stage_id);
    if (visee.id !== entree.id && actuelle && actuelle.type !== 'perdu' && actuelle.ordre < visee.ordre) {
      const { error } = await admin
        .from('leads')
        .update({ stage_id: visee.id, stage_position: position, stage_changed_at: now })
        .eq('id', choix.lead.id)
        .eq('agency_id', qui.agencyId);
      if (error) console.error('[pipeline] avance', error.message);
    }
    return finir('deja', choix.lead.id);
  }

  if (choix.action === 'prendre') {
    const patch: Database['public']['Tables']['leads']['Update'] = {
      stage_id: stageId,
      stage_position: position,
      assigned_to: qui.profileId,
      assigned_by: qui.profileId,
      assigned_at: now,
      taken_at: now,
      stage_changed_at: now,
    };
    if (!choix.lead.notes && demande.notes) patch.notes = demande.notes;
    const { error } = await admin.from('leads').update(patch).eq('id', choix.lead.id).eq('agency_id', qui.agencyId);
    if (error) {
      console.error('[pipeline] prise', error.message);
      return { erreur: 'Impossible d’ajouter au pipeline pour le moment' };
    }
    return finir('pris', choix.lead.id);
  }

  const insert = {
    agency_id: qui.agencyId,
    address: demande.address,
    city: demande.city,
    postal_code: demande.postalCode,
    latitude: demande.latitude,
    longitude: demande.longitude,
    ban_id: ban.banId,
    adresse_normalisee: ban.adresse,
    owner_type: demande.ownerType,
    company_name: demande.ownerType === 'entreprise' ? demande.companyName : null,
    score: 0,
    signals: [],
    display_signals: {},
    surface_m2: demande.surfaceM2,
    rooms: demande.rooms,
    etage: demande.etage,
    dpe_class: demande.dpeClass,
    property_type: demande.propertyType,
    notes: demande.notes,
    stage_id: stageId,
    stage_position: position,
    assigned_to: qui.profileId,
    assigned_by: qui.profileId,
    assigned_at: now,
    taken_at: now,
    stage_changed_at: now,
    delivered_at: ymdKey(parisYmd(new Date())),
    status: 'nouveau',
    collecte_base_legale: 'interet_legitime',
    collecte_provenance: demande.provenance,
    collecte_jeux_donnees: ['ban'],
    collecte_at: now,
  } as LeadInsert;

  const { data: cree, error: errInsert } = await admin.from('leads').insert(insert).select('id').maybeSingle();
  if (errInsert || !cree) {
    console.error('[pipeline] création', errInsert?.message ?? 'vide');
    return { erreur: 'Impossible d’ajouter au pipeline pour le moment' };
  }
  return finir('cree', cree.id);
}
