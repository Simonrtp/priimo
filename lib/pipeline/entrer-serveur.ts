import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { geocodeAdresse } from '@/lib/geo/ban';
import { LEADS_CLIENT_SELECT, mapDbLeadToLead } from '@/lib/queries/leads';
import { ymdKey, parisYmd } from '@/lib/today/calendar';
import type { Database, LeadInsert, LeadRow } from '@/types/database';
import type { Lead } from '@/types/lead';
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
};

type LigneExistante = { id: string; stage_id: string | null; score: number; notes: string | null };

function enFrance(lat: number, lng: number): boolean {
  return lat >= 41 && lat <= 51.5 && lng >= -5.5 && lng <= 10;
}

async function lireLead(admin: Admin, id: string): Promise<Lead | null> {
  const { data, error } = await admin.from('leads').select(LEADS_CLIENT_SELECT).eq('id', id).maybeSingle();
  if (error || !data) return null;
  return mapDbLeadToLead(data as unknown as LeadRow);
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
 * Pose l'adresse dans Pris. Une fiche déjà livrée à cette adresse est prise
 * plutôt que dupliquée. Déjà au pipeline : on le dit, sans deuxième carte.
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

  const { data: etapes, error: errEtape } = await admin
    .from('lead_stages')
    .select('id')
    .eq('agency_id', qui.agencyId)
    .eq('type', 'entree')
    .order('ordre', { ascending: true })
    .limit(1);
  if (errEtape) {
    console.error('[pipeline] entrée', errEtape.message);
    return { erreur: 'Impossible d’ajouter au pipeline pour le moment' };
  }
  const stageId = etapes?.[0]?.id;
  if (!stageId) return { erreur: 'Le pipeline n’a pas encore d’étape d’entrée' };

  const ban = await resoudreBan(demande);
  const existants = await fichesALadresse(admin, qui.agencyId, ban.banId, demande);
  const choix = deciderEntree(
    existants.map((row) => ({ ...row, stageId: row.stage_id })),
  );

  const now = new Date().toISOString();
  const position = await positionSuivante(admin, qui.agencyId, stageId);

  if (choix.action === 'deja') {
    const lead = await lireLead(admin, choix.lead.id);
    return lead ? { etat: 'deja', lead } : { erreur: 'Impossible d’ajouter au pipeline pour le moment' };
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
    const lead = await lireLead(admin, choix.lead.id);
    return lead ? { etat: 'pris', lead } : { erreur: 'Impossible d’ajouter au pipeline pour le moment' };
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
  const lead = await lireLead(admin, cree.id);
  return lead ? { etat: 'cree', lead } : { erreur: 'Impossible d’ajouter au pipeline pour le moment' };
}
