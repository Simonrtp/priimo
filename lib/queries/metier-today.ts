import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type {
  TodayBienMetier,
  TodayOffre,
  TodayPromesse,
  TodayRendezVous,
  TodayVisite,
} from '@/types/metier';
import { buildFullName } from '@/lib/queries/contacts';

type Client = SupabaseClient<Database>;

function contactName(row: { first_name: string | null; last_name: string | null } | null): string | null {
  if (!row) return null;
  return buildFullName(row.first_name ?? '', row.last_name ?? '') || null;
}

/** Tolère l'absence des tables avant migration. */
export async function fetchTodayMetierSafe(
  supabase: Client,
  profileId: string,
): Promise<{
  biens: TodayBienMetier[];
  visites: TodayVisite[];
  offres: TodayOffre[];
  promesses: TodayPromesse[];
  rendezVous: TodayRendezVous[];
}> {
  try {
    const [biens, visites, offres, promesses, rendezVous] = await Promise.all([
      fetchBiensMetier(supabase),
      fetchVisitesPostVisite(supabase),
      fetchOffresActives(supabase),
      fetchPromessesAFaire(supabase, profileId),
      fetchRendezVousAVenir(supabase, profileId),
    ]);
    return { biens, visites, offres, promesses, rendezVous };
  } catch (err) {
    console.error('[metier-today] lecture impossible, écran dégradé', err);
    return { biens: [], visites: [], offres: [], promesses: [], rendezVous: [] };
  }
}

async function fetchBiensMetier(supabase: Client): Promise<TodayBienMetier[]> {
  const { data, error } = await supabase
    .from('biens')
    .select(
      'id, address, mandat_type, mandat_signe_le, mandat_duree_mois, mandat_statut, price, latitude, longitude, visites(count)',
    )
    .in('mandat_statut', ['mandat_simple', 'mandat_exclusif', 'compromis']);

  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const visites = r.visites as { count: number }[] | null;
    return {
      id: String(r.id),
      address: String(r.address),
      mandatType: (r.mandat_type as TodayBienMetier['mandatType']) ?? null,
      mandatSigneLe: (r.mandat_signe_le as string | null) ?? null,
      mandatDureeMois: Number(r.mandat_duree_mois ?? 3),
      mandatStatut: String(r.mandat_statut),
      price: r.price != null ? Number(r.price) : null,
      latitude: r.latitude != null ? Number(r.latitude) : null,
      longitude: r.longitude != null ? Number(r.longitude) : null,
      visitCount: visites?.[0]?.count ?? 0,
    };
  });
}

async function fetchVisitesPostVisite(supabase: Client): Promise<TodayVisite[]> {
  const since = new Date(Date.now() - 72 * 3_600_000).toISOString();
  const { data, error } = await supabase
    .from('visites')
    .select(
      `
      id, bien_id, contact_id, date_visite,
      compte_rendu_acquereur_fait_le, compte_rendu_vendeur_fait_le,
      biens!inner ( address, proprietaire_contact_id, proprietaire:contacts!biens_proprietaire_contact_id_fkey ( first_name, last_name, phone ) ),
      contact:contacts!visites_contact_id_fkey ( first_name, last_name, phone )
    `,
    )
    .gte('date_visite', since)
    .or('compte_rendu_acquereur_fait_le.is.null,compte_rendu_vendeur_fait_le.is.null');

  if (error) throw error;

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const bien = r.biens as Record<string, unknown>;
    const contact = r.contact as { first_name: string | null; last_name: string | null; phone: string | null } | null;
    const proprietaire = bien.proprietaire as { first_name: string | null; last_name: string | null; phone: string | null } | null;
    return {
      id: String(r.id),
      bienId: String(r.bien_id),
      bienAddress: String(bien.address),
      contactId: r.contact_id ? String(r.contact_id) : null,
      contactName: contactName(contact),
      contactPhone: contact?.phone ?? null,
      dateVisite: String(r.date_visite),
      compteRenduAcquereurFaitLe: (r.compte_rendu_acquereur_fait_le as string | null) ?? null,
      compteRenduVendeurFaitLe: (r.compte_rendu_vendeur_fait_le as string | null) ?? null,
      proprietaireContactId: bien.proprietaire_contact_id ? String(bien.proprietaire_contact_id) : null,
      proprietaireName: contactName(proprietaire),
      proprietairePhone: proprietaire?.phone ?? null,
    };
  });
}

async function fetchOffresActives(supabase: Client): Promise<TodayOffre[]> {
  const { data, error } = await supabase
    .from('offres')
    .select(
      `
      id, bien_id, contact_id, montant, validite_jusqu_au, financement_echeance,
      compromis_signe_le, preemption_purgee_le, statut,
      biens!inner ( address ),
      contact:contacts ( first_name, last_name )
    `,
    )
    .eq('statut', 'en_attente');

  if (error) throw error;

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const bien = r.biens as { address: string };
    const contact = r.contact as { first_name: string | null; last_name: string | null } | null;
    return {
      id: String(r.id),
      bienId: String(r.bien_id),
      bienAddress: bien.address,
      contactId: r.contact_id ? String(r.contact_id) : null,
      contactName: contactName(contact),
      montant: Number(r.montant),
      validiteJusquAu: (r.validite_jusqu_au as string | null) ?? null,
      financementEcheance: (r.financement_echeance as string | null) ?? null,
      compromisSigneLe: (r.compromis_signe_le as string | null) ?? null,
      preemptionPurgeeLe: (r.preemption_purgee_le as string | null) ?? null,
      statut: r.statut as TodayOffre['statut'],
    };
  });
}

async function fetchPromessesAFaire(supabase: Client, profileId: string): Promise<TodayPromesse[]> {
  const { data, error } = await supabase
    .from('promesses')
    .select(
      `
      id, profile_id, contact_id, intitule, echeance, statut,
      contact:contacts ( first_name, last_name, phone )
    `,
    )
    .eq('profile_id', profileId)
    .eq('statut', 'a_faire');

  if (error) throw error;

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const contact = r.contact as { first_name: string | null; last_name: string | null; phone: string | null } | null;
    return {
      id: String(r.id),
      profileId: String(r.profile_id),
      contactId: r.contact_id ? String(r.contact_id) : null,
      contactName: contactName(contact),
      contactPhone: contact?.phone ?? null,
      intitule: String(r.intitule),
      echeance: String(r.echeance).slice(0, 10),
      statut: r.statut as TodayPromesse['statut'],
    };
  });
}

async function fetchRendezVousAVenir(supabase: Client, profileId: string): Promise<TodayRendezVous[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('rendez_vous')
    .select(
      `
      id, profile_id, contact_id, bien_id, debut, fin, type, lieu,
      contact:contacts ( first_name, last_name, phone ),
      biens ( address )
    `,
    )
    .eq('profile_id', profileId)
    .gte('fin', now)
    .order('debut', { ascending: true })
    .limit(20);

  if (error) throw error;

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const contact = r.contact as { first_name: string | null; last_name: string | null; phone: string | null } | null;
    const bien = r.biens as { address: string } | null;
    return {
      id: String(r.id),
      profileId: String(r.profile_id),
      contactId: r.contact_id ? String(r.contact_id) : null,
      contactName: contactName(contact),
      contactPhone: contact?.phone ?? null,
      bienId: r.bien_id ? String(r.bien_id) : null,
      bienAddress: bien?.address ?? null,
      debut: String(r.debut),
      fin: String(r.fin),
      type: r.type as TodayRendezVous['type'],
      lieu: (r.lieu as string | null) ?? null,
    };
  });
}
