import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Annonce, Confiance, EvenementAnnonce, Portail, RunAnnonce } from './types';

type Client = SupabaseClient<Database>;

const SELECT_ANNONCE = [
  'id',
  'id_portail',
  'portail',
  'url',
  'type_vendeur',
  'agence_nom',
  'refus_demarchage',
  'statut',
  'publiee_le',
  'premiere_vue_le',
  'derniere_vue_le',
  'retiree_le',
  'type_bien',
  'titre',
  'prix_initial',
  'prix',
  'surface',
  'pieces',
  'etage',
  'dpe',
  'code_postal',
  'ville',
  'quartier',
  'confiance',
  'localisation_precision',
  'adresse',
  'adresse_numero',
  'adresse_voie',
  'parcelle_ids',
  'numero_dpe',
  'complement_dpe',
  'latitude',
  'longitude',
  'logement_cle',
  'score_localisation',
  'raisons_localisation',
].join(', ');

function raisons(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

function portail(v: unknown): Portail {
  if (v === 'seloger' || v === 'pap' || v === 'leboncoin' || v === 'bienici' || v === 'logicimmo') return v;
  return 'pap';
}

function confiance(v: unknown): Confiance {
  if (v === 'certaine' || v === 'probable' || v === 'adresse_publiee' || v === 'incertaine') return v;
  return 'incertaine';
}

function versAnnonce(row: Record<string, unknown>): Annonce {
  return {
    id: String(row.id),
    idPortail: typeof row.id_portail === 'string' ? row.id_portail : null,
    portail: portail(row.portail),
    url: typeof row.url === 'string' ? row.url : '',
    typeVendeur: row.type_vendeur === 'professionnel' ? 'professionnel' : 'particulier',
    agenceNom: typeof row.agence_nom === 'string' ? row.agence_nom : null,
    refusDemarchage: row.refus_demarchage === true,
    statut: row.statut === 'retiree' ? 'retiree' : 'active',
    publieeLe: typeof row.publiee_le === 'string' ? row.publiee_le : null,
    premiereVueLe: typeof row.premiere_vue_le === 'string' ? row.premiere_vue_le : null,
    derniereVueLe: typeof row.derniere_vue_le === 'string' ? row.derniere_vue_le : null,
    retireeLe: typeof row.retiree_le === 'string' ? row.retiree_le : null,
    typeBien: typeof row.type_bien === 'string' ? row.type_bien : null,
    titre: typeof row.titre === 'string' ? row.titre : null,
    prixInitial: typeof row.prix_initial === 'number' ? row.prix_initial : null,
    prix: typeof row.prix === 'number' ? row.prix : null,
    surface: typeof row.surface === 'number' ? row.surface : null,
    pieces: typeof row.pieces === 'number' ? row.pieces : null,
    etage: row.etage == null ? null : String(row.etage),
    dpe: typeof row.dpe === 'string' ? row.dpe : null,
    codePostal: typeof row.code_postal === 'string' ? row.code_postal : null,
    ville: typeof row.ville === 'string' ? row.ville : null,
    quartier: typeof row.quartier === 'string' ? row.quartier : null,
    confiance: confiance(row.confiance),
    localisationPrecision:
      row.localisation_precision === 'logement' ||
      row.localisation_precision === 'immeuble' ||
      row.localisation_precision === 'quartier' ||
      row.localisation_precision === 'code_postal'
        ? row.localisation_precision
        : null,
    adresse: typeof row.adresse === 'string' ? row.adresse : null,
    adresseNumero: row.adresse_numero == null ? null : String(row.adresse_numero),
    adresseVoie: typeof row.adresse_voie === 'string' ? row.adresse_voie : null,
    parcelleIds: Array.isArray(row.parcelle_ids) ? row.parcelle_ids.filter((x) => typeof x === 'string') : [],
    numeroDpe: typeof row.numero_dpe === 'string' ? row.numero_dpe : null,
    complementDpe: typeof row.complement_dpe === 'string' ? row.complement_dpe : null,
    latitude: typeof row.latitude === 'number' ? row.latitude : null,
    longitude: typeof row.longitude === 'number' ? row.longitude : null,
    logementCle: typeof row.logement_cle === 'string' ? row.logement_cle : null,
    scoreLocalisation: typeof row.score_localisation === 'number' ? row.score_localisation : null,
    raisonsLocalisation: raisons(row.raisons_localisation),
  };
}

/** Les tables ne sont pas dans les types générés : elles vivent dans le pipeline. */
function table(client: Client, nom: 'annonces' | 'annonce_evenements' | 'annonces_runs') {
  return (client as unknown as SupabaseClient).from(nom);
}

const PAGE = 1000;
/** Garde-fou : un territoire d'agence compte quelques milliers d'annonces avec les agences. */
const PLAFOND = 8000;

/**
 * Toutes les annonces lisibles (RLS : territoire de l'agence), par pages de
 * 1 000 — la limite de PostgREST. `vendeur` réduit aux particuliers pour le
 * brief du matin, qui lit sans RLS.
 */
export async function lireAnnonces(
  client: Client,
  opts: { vendeur?: 'particulier' } = {},
): Promise<Annonce[]> {
  const lignes: Record<string, unknown>[] = [];
  for (let debut = 0; debut < PLAFOND; debut += PAGE) {
    let requete = table(client, 'annonces').select(SELECT_ANNONCE);
    if (opts.vendeur) requete = requete.eq('type_vendeur', opts.vendeur);
    const { data, error } = await requete
      .order('derniere_vue_le', { ascending: false })
      .order('id', { ascending: true })
      .range(debut, debut + PAGE - 1);
    if (error) {
      console.error('[annonces] lecture', error.message);
      break;
    }
    const lot = (data ?? []) as unknown as Record<string, unknown>[];
    lignes.push(...lot);
    if (lot.length < PAGE) break;
  }
  return lignes.map(versAnnonce);
}

/** Une annonce et les autres portails du même logement. */
export async function lireAnnonce(
  client: Client,
  id: string,
): Promise<{ annonce: Annonce; soeurs: Annonce[] } | null> {
  const { data, error } = await table(client, 'annonces').select(SELECT_ANNONCE).eq('id', id).maybeSingle();
  if (error) {
    console.error('[annonces] lecture', error.message);
    return null;
  }
  if (!data) return null;
  const annonce = versAnnonce(data as unknown as Record<string, unknown>);
  if (!annonce.logementCle) return { annonce, soeurs: [annonce] };
  const { data: memes } = await table(client, 'annonces')
    .select(SELECT_ANNONCE)
    .eq('logement_cle', annonce.logementCle)
    .limit(20);
  const soeurs = ((memes ?? []) as unknown as Record<string, unknown>[]).map(versAnnonce);
  return { annonce, soeurs: soeurs.length > 0 ? soeurs : [annonce] };
}

/**
 * Annonces rattachées à une parcelle. Le pipeline ne pose `parcelle_ids` que
 * sur une adresse retrouvée ou publiée : jamais sur un repère approximatif.
 */
export async function lireAnnoncesParcelle(client: Client, parcelleId: string): Promise<Annonce[]> {
  const { data, error } = await table(client, 'annonces')
    .select(SELECT_ANNONCE)
    .contains('parcelle_ids', [parcelleId])
    .order('derniere_vue_le', { ascending: false })
    .limit(40);
  if (error) {
    console.error('[annonces] parcelle', error.message);
    return [];
  }
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(versAnnonce);
}

/** Par lots : une liste `in.(…)` de plusieurs centaines d'UUID dépasse la longueur d'URL admise. */
const LOT_IDS = 150;

export async function lireEvenements(client: Client, annonceIds: string[]): Promise<EvenementAnnonce[]> {
  if (annonceIds.length === 0) return [];
  const lignes: Record<string, unknown>[] = [];
  for (let i = 0; i < annonceIds.length; i += LOT_IDS) {
    const { data, error } = await table(client, 'annonce_evenements')
      .select('id, annonce_id, type, survenu_le, avant, apres, created_at')
      .in('annonce_id', annonceIds.slice(i, i + LOT_IDS))
      .order('survenu_le', { ascending: true });
    if (error) {
      console.error('[annonces] événements', error.message);
      return [];
    }
    lignes.push(...((data ?? []) as unknown as Record<string, unknown>[]));
  }
  lignes.sort((a, b) => String(a.survenu_le ?? '').localeCompare(String(b.survenu_le ?? '')));
  return lignes.map((row) => ({
    id: String(row.id),
    annonceId: String(row.annonce_id),
    type:
      row.type === 'nouvelle' ||
      row.type === 'baisse_prix' ||
      row.type === 'hausse_prix' ||
      row.type === 'modification' ||
      row.type === 'retiree' ||
      row.type === 'remise_en_ligne'
        ? row.type
        : 'modification',
    survenuLe: typeof row.survenu_le === 'string' ? row.survenu_le : String(row.created_at ?? ''),
    avant: row.avant && typeof row.avant === 'object' ? (row.avant as Record<string, unknown>) : null,
    apres: row.apres && typeof row.apres === 'object' ? (row.apres as Record<string, unknown>) : null,
    createdAt: typeof row.created_at === 'string' ? row.created_at : '',
  }));
}

export async function lireRuns(client: Client): Promise<RunAnnonce[]> {
  const { data, error } = await table(client, 'annonces_runs')
    .select('portail, status, started_at, finished_at')
    .order('started_at', { ascending: false })
    .limit(20);
  if (error) {
    console.error('[annonces] runs', error.message);
    return [];
  }
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
    portail: String(row.portail ?? ''),
    status:
      row.status === 'running' || row.status === 'success' || row.status === 'partial' || row.status === 'failed'
        ? row.status
        : 'failed',
    startedAt: typeof row.started_at === 'string' ? row.started_at : '',
    finishedAt: typeof row.finished_at === 'string' ? row.finished_at : null,
  }));
}
