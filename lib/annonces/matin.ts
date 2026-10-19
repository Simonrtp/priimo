import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { fetchZonesPourAgence } from '@/lib/queries/zones';
import { lireAnnonces, lireAnnoncesParIds, lireEvenements } from './lire';
import {
  jourParis,
  notifierAnnonces,
  TYPES_NOTIF_ANNONCES,
  type AgenceCouvrante,
  type DestinataireAnnonce,
} from './notifier';

type Admin = SupabaseClient<Database>;

export async function curseurAnnonces(admin: Admin): Promise<string | null> {
  const { data, error } = await admin
    .from('notifications')
    .select('created_at')
    .in('type', [...TYPES_NOTIF_ANNONCES])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[annonces] curseur', error.message);
    return new Date().toISOString();
  }
  return data?.created_at ?? null;
}

/** Cloche « Suivre » : annonce → agents. Vide tant que la table n'existe pas. */
async function lireSuivis(admin: Admin): Promise<Map<string, DestinataireAnnonce[]>> {
  const suivis = new Map<string, DestinataireAnnonce[]>();
  const { data, error } = await (admin as unknown as SupabaseClient)
    .from('annonces_suivies')
    .select('annonce_id, agency_id, profile_id');
  if (error) return suivis;
  for (const row of (data ?? []) as Array<{ annonce_id: string; agency_id: string; profile_id: string }>) {
    const liste = suivis.get(row.annonce_id) ?? [];
    liste.push({ agencyId: row.agency_id, profileId: row.profile_id });
    suivis.set(row.annonce_id, liste);
  }
  return suivis;
}

/**
 * Une passe au brief du matin. Le pipeline a tourné la veille au soir :
 * on notifie les événements créés depuis le brief précédent.
 * Sans curseur, on ne rattrape pas l'historique plus vieux qu'hier.
 */
export async function traiterAnnoncesDuMatin(admin: Admin, maintenant = new Date()): Promise<number> {
  // Les particuliers du secteur, plus les annonces que des agents suivent (cloche), quel que soit le vendeur.
  const suivis = await lireSuivis(admin);
  const particuliers = await lireAnnonces(admin, { vendeur: 'particulier' });
  const connues = new Set(particuliers.map((a) => a.id));
  const enPlus = await lireAnnoncesParIds(admin, [...suivis.keys()].filter((id) => !connues.has(id)));
  const annonces = [...particuliers, ...enPlus];
  if (annonces.length === 0) return 0;
  let evenements = await lireEvenements(
    admin,
    annonces.map((a) => a.id),
  );
  const curseur = await curseurAnnonces(admin);
  if (!curseur) {
    const aujourdHui = jourParis(maintenant);
    const hier = jourParis(new Date(maintenant.getTime() - 86_400_000));
    evenements = evenements.filter((e) => {
      const jour = jourParis(new Date(e.createdAt));
      return jour === aujourdHui || jour === hier;
    });
  }
  const { data: agences, error } = await admin.from('agencies').select('id, codes_postaux');
  if (error) {
    console.error('[annonces] agences', error.message);
    return 0;
  }
  const couvrantes: AgenceCouvrante[] = [];
  for (const row of agences ?? []) {
    const codes = (row.codes_postaux ?? []).filter((c): c is string => typeof c === 'string');
    if (codes.length === 0) continue;
    const zones = await fetchZonesPourAgence(admin, row.id);
    const { data: membres } = await admin
      .from('profile_agencies')
      .select('profile_id')
      .eq('agency_id', row.id)
      .eq('role', 'directeur');
    couvrantes.push({
      agencyId: row.id,
      codesPostaux: codes,
      zones,
      directeurs: (membres ?? []).map((m) => m.profile_id),
    });
  }
  const { ecrites } = await notifierAnnonces(admin, {
    maintenant,
    curseurIso: curseur,
    annonces,
    evenements,
    agences: couvrantes,
    suivis,
  });
  return ecrites;
}
