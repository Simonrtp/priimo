/**
 * Collecte — le seul endroit qui parle à la base pour les automatisations.
 *
 * Chaque veille est isolée : si l'API ADEME tombe ou si une table manque, la
 * veille concernée rend zéro proposition et les autres passent quand même.
 * Un cron qui s'arrête à la première erreur, c'est une agence qui ne reçoit
 * plus rien pendant une semaine sans que personne ne s'en aperçoive.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContactRow, Database } from '@/types/database';
import type { Contact } from '@/types/contact';
import { CONTACTS_SELECT, mapDbContactToContact } from '@/lib/queries/contacts';
import { fetchDpeSecteur } from '@/lib/geo/ademe';
import { proposerComptesRendus, type ActiviteBien, type BienSousMandat } from './compte-rendu';
import { proposerEngagements, type PromesseOuverte, type TraceInteraction } from './engagements';
import {
  proposerEstimationsDormantes,
  type EstimationDormante,
} from './estimations-dormantes';
import {
  proposerRapprochementsInverses,
  type BienHorsMandat,
} from './rapprochement-inverse';
import { proposerVeilleDpe, type AdresseSuivie } from './veille-dpe';
import { proposerVeilleMutations, type MutationRecente } from './veille-mutation';
import type { AutomationKind, ProposedAction } from './types';

type Client = SupabaseClient<Database>;

export interface AgenceCible {
  id: string;
  codesPostaux: readonly string[];
}

export interface ResultatCollecte {
  propositions: ProposedAction[];
  /** Veilles qui ont échoué, pour le journal du cron. */
  echecs: { automation: AutomationKind; message: string }[];
}

/** Exécute une veille sans jamais laisser son échec contaminer les autres. */
async function isoler(
  automation: AutomationKind,
  echecs: ResultatCollecte['echecs'],
  run: () => Promise<ProposedAction[]>,
): Promise<ProposedAction[]> {
  try {
    return await run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[automations] ${automation}`, message);
    echecs.push({ automation, message });
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Chargements partagés                                                       */
/* -------------------------------------------------------------------------- */

const BIENS_SELECT =
  'id, address, postal_code, price, surface_m2, rooms, mandat_statut, mandat_date, proprietaire_contact_id, assigned_to, created_by, created_at';

type BienBrut = {
  id: string;
  address: string;
  postal_code: string | null;
  price: number | null;
  surface_m2: number | null;
  rooms: number | null;
  mandat_statut: BienHorsMandat['mandatStatut'];
  mandat_date: string | null;
  proprietaire_contact_id: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
};

async function chargerBiens(admin: Client, agencyId: string): Promise<BienBrut[]> {
  const { data, error } = await admin
    .from('biens')
    .select(BIENS_SELECT)
    .eq('agency_id', agencyId)
    .in('mandat_statut', ['estimation', 'mandat_simple', 'mandat_exclusif']);

  if (error) throw new Error(`biens: ${error.message}`);
  return (data ?? []) as unknown as BienBrut[];
}

async function chargerContacts(admin: Client, agencyId: string): Promise<Contact[]> {
  const { data, error } = await admin
    .from('contacts')
    .select(CONTACTS_SELECT)
    .eq('agency_id', agencyId);

  if (error) throw new Error(`contacts: ${error.message}`);
  return (data ?? []).map((row) => mapDbContactToContact(row as unknown as ContactRow));
}

/** Nom du propriétaire résolu depuis les contacts déjà chargés. */
function indexContacts(contacts: readonly Contact[]): Map<string, Contact> {
  return new Map(contacts.map((c) => [c.id, c]));
}

/**
 * Les adresses que l'agence suit — la matière du rapprochement des veilles.
 * Un bien au mandat y figure aussi, marqué comme tel : c'est ce marqueur qui
 * évite d'annoncer un signal sur un bien qu'on commercialise déjà.
 */
function adressesSuivies(
  biens: readonly BienBrut[],
  contacts: readonly Contact[],
): AdresseSuivie[] {
  const index = indexContacts(contacts);

  const depuisBiens: AdresseSuivie[] = biens.map((b) => ({
    entite: 'bien',
    id: b.id,
    adresse: b.address,
    codePostal: b.postal_code,
    label: b.proprietaire_contact_id
      ? (index.get(b.proprietaire_contact_id)?.fullName ?? null)
      : null,
    assignedTo: b.assigned_to ?? b.created_by ?? null,
    dejaAuMandat: b.mandat_statut === 'mandat_simple' || b.mandat_statut === 'mandat_exclusif',
  }));

  const depuisContacts: AdresseSuivie[] = contacts
    .filter((c) => c.address && c.type === 'vendeur')
    .map((c) => ({
      entite: 'contact',
      id: c.id,
      adresse: c.address!,
      codePostal: null,
      label: c.fullName,
      assignedTo: c.assignedTo ?? c.createdBy ?? null,
    }));

  return [...depuisBiens, ...depuisContacts];
}

/* -------------------------------------------------------------------------- */
/* Veilles                                                                    */
/* -------------------------------------------------------------------------- */

function versBienHorsMandat(b: BienBrut, index: Map<string, Contact>): BienHorsMandat {
  const proprio = b.proprietaire_contact_id ? index.get(b.proprietaire_contact_id) : undefined;
  return {
    id: b.id,
    address: b.address,
    postalCode: b.postal_code,
    price: b.price,
    surfaceM2: b.surface_m2,
    rooms: b.rooms,
    mandatStatut: b.mandat_statut,
    proprietaireName: proprio?.fullName ?? null,
    proprietairePhone: proprio?.phone ?? null,
    assignedTo: b.assigned_to,
    createdBy: b.created_by,
    createdAt: b.created_at,
  };
}

async function activitesParBien(
  admin: Client,
  agencyId: string,
  bienIds: readonly string[],
): Promise<Record<string, ActiviteBien>> {
  if (bienIds.length === 0) return {};

  const [diffusions, visites, offres] = await Promise.all([
    admin
      .from('diffusion_annonces')
      .select('bien_id, portail, publiee_at')
      .eq('agency_id', agencyId)
      .in('bien_id', bienIds as string[])
      .not('publiee_at', 'is', null),
    admin
      .from('visites')
      .select('bien_id, date_visite')
      .eq('agency_id', agencyId)
      .in('bien_id', bienIds as string[]),
    admin
      .from('offres')
      .select('bien_id, montant, soumise_le')
      .eq('agency_id', agencyId)
      .in('bien_id', bienIds as string[]),
  ]);

  const out: Record<string, ActiviteBien> = {};
  const bucket = (id: string): { diffusions: unknown[]; visites: unknown[]; offres: unknown[] } => {
    const existant = out[id] as unknown as
      | { diffusions: unknown[]; visites: unknown[]; offres: unknown[] }
      | undefined;
    if (existant) return existant;
    const frais = { diffusions: [], visites: [], offres: [] };
    out[id] = frais as unknown as ActiviteBien;
    return frais;
  };

  for (const row of diffusions.data ?? []) {
    const r = row as { bien_id: string; portail: string; publiee_at: string | null };
    if (!r.publiee_at) continue;
    bucket(r.bien_id).diffusions.push({ portail: r.portail, publieLe: r.publiee_at });
  }
  for (const row of visites.data ?? []) {
    const r = row as { bien_id: string; date_visite: string };
    bucket(r.bien_id).visites.push({ date: r.date_visite });
  }
  for (const row of offres.data ?? []) {
    const r = row as { bien_id: string; montant: number | null; soumise_le: string };
    bucket(r.bien_id).offres.push({ date: r.soumise_le, montant: r.montant });
  }

  return out;
}

async function chargerPromesses(
  admin: Client,
  agencyId: string,
  contacts: readonly Contact[],
): Promise<{ promesses: PromesseOuverte[]; interactions: TraceInteraction[] }> {
  const index = indexContacts(contacts);

  const { data, error } = await admin
    .from('promesses')
    .select('id, profile_id, contact_id, intitule, echeance, created_at')
    .eq('agency_id', agencyId)
    .eq('statut', 'a_faire');

  if (error) throw new Error(`promesses: ${error.message}`);

  const promesses: PromesseOuverte[] = (data ?? []).map((row) => {
    const r = row as {
      id: string;
      profile_id: string;
      contact_id: string | null;
      intitule: string;
      echeance: string;
      created_at: string;
    };
    return {
      id: r.id,
      profileId: r.profile_id,
      contactId: r.contact_id,
      contactName: r.contact_id ? (index.get(r.contact_id)?.fullName ?? null) : null,
      intitule: r.intitule,
      echeance: r.echeance,
      createdAt: r.created_at,
    };
  });

  const contactIds = [...new Set(promesses.map((p) => p.contactId).filter((id): id is string => !!id))];
  if (contactIds.length === 0) return { promesses, interactions: [] };

  // Une note écrite ne prouve pas qu'on a rappelé : seuls les échanges comptent.
  const { data: rows } = await admin
    .from('contact_interactions')
    .select('contact_id, occurred_at, kind')
    .in('contact_id', contactIds)
    .in('kind', ['appel', 'visite', 'email', 'vocal']);

  const interactions: TraceInteraction[] = (rows ?? []).map((row) => {
    const r = row as { contact_id: string; occurred_at: string };
    return { contactId: r.contact_id, occurredAt: r.occurred_at };
  });

  return { promesses, interactions };
}

/** Prix au m² courant par code postal, d'après les mutations de l'année. */
async function prixM2Actuels(
  admin: Client,
  codesPostaux: readonly string[],
  now: Date,
): Promise<Record<string, number>> {
  if (codesPostaux.length === 0) return {};
  const depuis = new Date(now.getTime() - 365 * 86_400_000).toISOString().slice(0, 10);

  const { data, error } = await admin
    .from('building_transactions')
    .select('code_postal, prix_m2')
    .in('code_postal', codesPostaux as string[])
    .gte('date_mutation', depuis)
    .not('prix_m2', 'is', null);

  if (error) throw new Error(`building_transactions: ${error.message}`);

  const sommes: Record<string, { total: number; n: number }> = {};
  for (const row of data ?? []) {
    const r = row as { code_postal: string | null; prix_m2: number | null };
    if (!r.code_postal || !r.prix_m2 || r.prix_m2 <= 0) continue;
    const acc = sommes[r.code_postal] ?? { total: 0, n: 0 };
    acc.total += r.prix_m2;
    acc.n += 1;
    sommes[r.code_postal] = acc;
  }

  const out: Record<string, number> = {};
  for (const [cp, { total, n }] of Object.entries(sommes)) {
    // Sous 5 mutations, la moyenne dit surtout le hasard.
    if (n >= 5) out[cp] = total / n;
  }
  return out;
}

async function chargerEstimationsDormantes(
  admin: Client,
  agencyId: string,
  contacts: readonly Contact[],
  biens: readonly BienBrut[],
): Promise<EstimationDormante[]> {
  const { data, error } = await admin
    .from('agency_estimations')
    .select('id, address, postal_code, surface_m2, price_value, created_by, created_at')
    .eq('agency_id', agencyId);

  if (error) throw new Error(`agency_estimations: ${error.message}`);

  const index = indexContacts(contacts);
  const rentrees = new Set(
    biens
      .filter((b) => b.mandat_statut !== 'estimation')
      .map((b) => b.address.trim().toLowerCase()),
  );

  return (data ?? []).map((row) => {
    const r = row as {
      id: string;
      address: string;
      postal_code: string | null;
      surface_m2: number | null;
      price_value: number | null;
      created_by: string | null;
      created_at: string;
    };
    const proprio = [...index.values()].find(
      (c) => c.address && c.address.trim().toLowerCase() === r.address.trim().toLowerCase(),
    );
    return {
      id: r.id,
      bienId: null,
      adresse: r.address,
      codePostal: r.postal_code,
      contactId: proprio?.id ?? null,
      proprietaireName: proprio?.fullName ?? null,
      proprietairePhone: proprio?.phone ?? null,
      estimeeLe: r.created_at,
      valeurEstimee: r.price_value,
      surfaceM2: r.surface_m2,
      assignedTo: proprio?.assignedTo ?? null,
      createdBy: r.created_by,
      rentree: rentrees.has(r.address.trim().toLowerCase()),
    };
  });
}

async function chargerMutations(
  admin: Client,
  codesPostaux: readonly string[],
  now: Date,
): Promise<MutationRecente[]> {
  if (codesPostaux.length === 0) return [];
  const depuis = new Date(now.getTime() - 45 * 86_400_000).toISOString();

  const { data, error } = await admin
    .from('building_transactions')
    .select('id, id_mutation, ban_id, code_postal, date_mutation, valeur_fonciere, surface_reelle_bati, prix_m2, type_local, created_at')
    .in('code_postal', codesPostaux as string[])
    .gte('created_at', depuis);

  if (error) throw new Error(`building_transactions: ${error.message}`);

  const lignes = (data ?? []) as unknown as {
    id: string;
    id_mutation: string | null;
    ban_id: string | null;
    code_postal: string | null;
    date_mutation: string;
    valeur_fonciere: number | null;
    surface_reelle_bati: number | null;
    prix_m2: number | null;
    type_local: string | null;
    created_at: string;
  }[];

  // L'adresse ne vit pas dans la table des mutations : elle se résout par le
  // pivot BAN, dans `buildings`. Sans adresse, aucun rapprochement possible —
  // on laisse tomber la ligne plutôt que d'annoncer « une vente quelque part ».
  const banIds = [...new Set(lignes.map((l) => l.ban_id).filter((id): id is string => !!id))];
  const adresses = new Map<string, string>();
  if (banIds.length > 0) {
    const { data: immeubles } = await admin
      .from('buildings')
      .select('ban_id, adresse')
      .in('ban_id', banIds);
    for (const row of immeubles ?? []) {
      const r = row as { ban_id: string; adresse: string | null };
      if (r.ban_id && r.adresse) adresses.set(r.ban_id, r.adresse);
    }
  }

  const out: MutationRecente[] = [];
  for (const l of lignes) {
    const adresse = l.ban_id ? adresses.get(l.ban_id) : undefined;
    if (!adresse) continue;
    out.push({
      id: l.id,
      idMutation: l.id_mutation,
      adresse,
      codePostal: l.code_postal,
      dateMutation: l.date_mutation,
      decouverteLe: l.created_at,
      valeurFonciere: l.valeur_fonciere,
      surfaceM2: l.surface_reelle_bati,
      prixM2: l.prix_m2,
      typeLocal: l.type_local,
    });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Orchestration                                                              */
/* -------------------------------------------------------------------------- */

export async function collecterPropositions(
  admin: Client,
  agence: AgenceCible,
  now: Date = new Date(),
): Promise<ResultatCollecte> {
  const echecs: ResultatCollecte['echecs'] = [];

  // Deux chargements servent presque toutes les veilles : ils sortent du
  // périmètre isolé, car sans eux il n'y a rien à faire du tout.
  let biens: BienBrut[] = [];
  let contacts: Contact[] = [];
  try {
    [biens, contacts] = await Promise.all([
      chargerBiens(admin, agence.id),
      chargerContacts(admin, agence.id),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[automations] chargement de base', agence.id, message);
    return { propositions: [], echecs: [{ automation: 'rapprochement_inverse', message }] };
  }

  const index = indexContacts(contacts);
  const suivies = adressesSuivies(biens, contacts);
  const acquereurs = contacts.filter((c) => c.type === 'acquereur');

  const lots = await Promise.all([
    isoler('rapprochement_inverse', echecs, async () =>
      proposerRapprochementsInverses({
        biens: biens.map((b) => versBienHorsMandat(b, index)),
        acquereurs,
        now,
      }),
    ),

    isoler('compte_rendu_mandat', echecs, async () => {
      const sousMandat = biens.filter(
        (b) => b.mandat_statut === 'mandat_simple' || b.mandat_statut === 'mandat_exclusif',
      );
      if (sousMandat.length === 0) return [];
      const activites = await activitesParBien(
        admin,
        agence.id,
        sousMandat.map((b) => b.id),
      );
      const cibles: BienSousMandat[] = sousMandat.map((b) => {
        const proprio = b.proprietaire_contact_id ? index.get(b.proprietaire_contact_id) : undefined;
        return {
          id: b.id,
          address: b.address,
          price: b.price,
          mandatStatut: b.mandat_statut,
          mandatDate: b.mandat_date,
          proprietaireName: proprio?.fullName ?? null,
          proprietaireEmail: proprio?.email ?? null,
          assignedTo: b.assigned_to,
          createdBy: b.created_by,
        };
      });
      return proposerComptesRendus({ biens: cibles, activites, now });
    }),

    isoler('engagement_note', echecs, async () => {
      const { promesses, interactions } = await chargerPromesses(admin, agence.id, contacts);
      return proposerEngagements({ promesses, interactions, now });
    }),

    isoler('estimation_dormante', echecs, async () => {
      const [estimations, prix] = await Promise.all([
        chargerEstimationsDormantes(admin, agence.id, contacts, biens),
        prixM2Actuels(admin, agence.codesPostaux, now),
      ]);
      return proposerEstimationsDormantes({ estimations, prixM2Actuels: prix, now });
    }),

    isoler('veille_dpe', echecs, async () => {
      if (agence.codesPostaux.length === 0) return [];
      const depuis = new Date(now.getTime() - 60 * 86_400_000).toISOString().slice(0, 10);
      const dpes = await fetchDpeSecteur(agence.codesPostaux, depuis);
      return proposerVeilleDpe({
        dpes,
        secteur: agence.codesPostaux,
        adressesSuivies: suivies,
        now,
      });
    }),

    isoler('veille_mutation', echecs, async () => {
      const mutations = await chargerMutations(admin, agence.codesPostaux, now);
      return proposerVeilleMutations({
        mutations,
        secteur: agence.codesPostaux,
        adressesSuivies: suivies,
        now,
      });
    }),
  ]);

  return { propositions: lots.flat(), echecs };
}
