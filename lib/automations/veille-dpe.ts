/**
 * Veille DPE — le signal de vente avant l'annonce.
 *
 * Un diagnostic de performance énergétique fraîchement réalisé sur un logement
 * existant est le meilleur signal public d'une mise en vente prochaine : on ne
 * paie pas un DPE pour le plaisir. La donnée est publique (base ADEME), donc
 * accessible à tout le monde — mais personne ne la *pousse* à l'agent, chacun
 * attend d'aller la chercher.
 *
 * Deux cas, très inégaux :
 *   — le DPE tombe sur une adresse déjà suivie (estimation, lead, contact) :
 *     l'intention passe de supposée à confirmée. C'est le signal le plus fort
 *     du produit, et il justifie un appel le jour même.
 *   — le DPE tombe sur une adresse inconnue : c'est une piste neuve, à qualifier.
 *
 * Module pur : la récupération des données vit dans `lib/geo/ademe.ts`.
 */

import type { DpeLettre } from '@/types/bien';
import { normalizeTexte, significantSearchTokens } from '@/lib/assistant/normalize';
import { dedupKey } from './dedup';
import { clampScore, expiresInDays, type ProposedAction } from './types';

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

export interface VeilleDpeConfig {
  /** Au-delà, le bien est probablement déjà en vitrine : le signal a servi. */
  fraicheurMaxJours: number;
  /** En deçà, le signal est brûlant et remonte en tête. */
  tresFraisJours: number;
  maxPropositions: number;
  expirationJours: number;
}

export const VEILLE_DPE_CONFIG: VeilleDpeConfig = {
  fraicheurMaxJours: 60,
  tresFraisJours: 7,
  maxPropositions: 15,
  expirationJours: 45,
};

/* -------------------------------------------------------------------------- */
/* Entrées                                                                    */
/* -------------------------------------------------------------------------- */

/** Un DPE normalisé, tel que le client ADEME le rend. */
export interface DpeRecent {
  numeroDpe: string;
  adresse: string;
  codePostal: string | null;
  commune: string | null;
  /** Date d'établissement (YYYY-MM-DD). */
  dateEtablissement: string;
  lettre: DpeLettre | null;
  surfaceM2: number | null;
  /** « maison », « appartement »… tel que fourni. */
  typeBatiment: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** Une adresse que l'agence suit déjà. */
export interface AdresseSuivie {
  entite: 'bien' | 'lead' | 'contact';
  id: string;
  adresse: string;
  codePostal: string | null;
  /** Nom affiché du propriétaire ou du prospect, s'il est connu. */
  label: string | null;
  assignedTo: string | null;
  /**
   * Un bien déjà au mandat : le DPE est une formalité que l'agence a
   * elle-même déclenchée. Aucun signal là-dedans.
   */
  dejaAuMandat?: boolean;
}

export interface VeilleDpeInput {
  dpes: readonly DpeRecent[];
  /** Codes postaux couverts par l'agence. Vide = aucune proposition. */
  secteur: readonly string[];
  adressesSuivies: readonly AdresseSuivie[];
  now?: Date;
  config?: VeilleDpeConfig;
}

/* -------------------------------------------------------------------------- */
/* Rapprochement d'adresse — strict par construction                          */
/* -------------------------------------------------------------------------- */

/** Numéro de voie en tête d'adresse (« 12 bis rue… » → « 12 »). */
export function numeroDeVoie(adresse: string): string | null {
  const m = normalizeTexte(adresse).match(/^(\d{1,4})\b/);
  return m ? m[1]! : null;
}

/**
 * Deux adresses désignent-elles le même logement ?
 *
 * Exigeant volontairement : même code postal, même numéro de voie, et tous les
 * mots porteurs du nom de rue en commun. Un faux positif ici ferait dire au
 * produit « votre prospect vend » à propos du voisin — la confiance ne s'en
 * remettrait pas. Mieux vaut rater un rapprochement que l'inventer.
 */
export function memeAdresse(
  a: { adresse: string; codePostal: string | null },
  b: { adresse: string; codePostal: string | null },
): boolean {
  if (a.codePostal && b.codePostal && a.codePostal !== b.codePostal) return false;

  const numA = numeroDeVoie(a.adresse);
  const numB = numeroDeVoie(b.adresse);
  if (numA === null || numB === null || numA !== numB) return false;

  const tokensA = significantSearchTokens(a.adresse);
  const tokensB = new Set(significantSearchTokens(b.adresse));
  if (tokensA.length === 0 || tokensB.size === 0) return false;

  return tokensA.every((t) => tokensB.has(t));
}

/* -------------------------------------------------------------------------- */
/* Formulation                                                                */
/* -------------------------------------------------------------------------- */

const PASSOIRES: readonly DpeLettre[] = ['F', 'G'];

function estPassoire(lettre: DpeLettre | null): boolean {
  return lettre !== null && PASSOIRES.includes(lettre);
}

function joursDepuis(dateIso: string, now: Date): number | null {
  const t = Date.parse(dateIso);
  if (!Number.isFinite(t)) return null;
  return Math.floor((now.getTime() - t) / 86_400_000);
}

function quand(jours: number | null): string {
  if (jours === null) return 'récemment';
  if (jours <= 0) return "aujourd'hui";
  if (jours === 1) return 'hier';
  if (jours < 7) return `il y a ${jours} jours`;
  if (jours < 14) return 'la semaine dernière';
  return `il y a ${Math.floor(jours / 7)} semaines`;
}

function descriptionBien(dpe: DpeRecent): string {
  const bouts: string[] = [];
  if (dpe.typeBatiment) bouts.push(dpe.typeBatiment.toLowerCase());
  if (dpe.surfaceM2) bouts.push(`${Math.round(dpe.surfaceM2)} m²`);
  if (dpe.lettre) bouts.push(`DPE ${dpe.lettre}`);
  return bouts.join(', ');
}

/* -------------------------------------------------------------------------- */
/* Moteur                                                                     */
/* -------------------------------------------------------------------------- */

function scoreSignal(
  dpe: DpeRecent,
  suivi: AdresseSuivie | null,
  jours: number | null,
  config: VeilleDpeConfig,
): number {
  let score = 55;
  // Une adresse déjà suivie qui fait faire son DPE : l'intention est confirmée.
  if (suivi) score += 25;
  if (estPassoire(dpe.lettre)) score += 10;
  if (jours !== null && jours <= config.tresFraisJours) score += 10;
  return clampScore(score);
}

export function proposerVeilleDpe(input: VeilleDpeInput): ProposedAction[] {
  const now = input.now ?? new Date();
  const config = input.config ?? VEILLE_DPE_CONFIG;
  const secteur = new Set(input.secteur);
  if (secteur.size === 0) return [];

  const propositions: ProposedAction[] = [];

  for (const dpe of input.dpes) {
    if (!dpe.codePostal || !secteur.has(dpe.codePostal)) continue;

    const jours = joursDepuis(dpe.dateEtablissement, now);
    if (jours === null || jours < 0 || jours > config.fraicheurMaxJours) continue;

    const suivi =
      input.adressesSuivies.find((a) =>
        memeAdresse({ adresse: dpe.adresse, codePostal: dpe.codePostal }, a),
      ) ?? null;

    // Le DPE d'un bien qu'on commercialise déjà : c'est nous qui l'avons
    // demandé. Aucune information.
    if (suivi?.dejaAuMandat) continue;

    const description = descriptionBien(dpe);
    const titre = suivi
      ? `${suivi.label ?? 'Un suivi'} prépare la vente — DPE au ${dpe.adresse}`
      : `Nouveau DPE au ${dpe.adresse}`;

    const detailBouts = [`DPE réalisé ${quand(jours)}`];
    if (description) detailBouts.push(description);
    if (suivi) {
      detailBouts.push(`adresse déjà suivie (${suivi.entite})`);
    } else if (estPassoire(dpe.lettre)) {
      detailBouts.push('passoire énergétique : le vendeur va chercher conseil');
    }

    propositions.push({
      kind: 'veille_dpe',
      // Un numéro de DPE ne sort qu'une fois : proposition strictement ponctuelle.
      dedupKey: dedupKey('veille_dpe', dpe.numeroDpe),
      titre,
      detail: `${detailBouts.join(' · ')}.`,
      score: scoreSignal(dpe, suivi, jours, config),
      assignedTo: suivi?.assignedTo ?? null,
      expiresAt: expiresInDays(config.expirationJours, now),
      payload: {
        numeroDpe: dpe.numeroDpe,
        adresse: dpe.adresse,
        codePostal: dpe.codePostal,
        commune: dpe.commune,
        dateEtablissement: dpe.dateEtablissement,
        lettre: dpe.lettre,
        surfaceM2: dpe.surfaceM2,
        typeBatiment: dpe.typeBatiment,
        latitude: dpe.latitude,
        longitude: dpe.longitude,
        passoire: estPassoire(dpe.lettre),
        suivi: suivi
          ? { entite: suivi.entite, id: suivi.id, label: suivi.label }
          : null,
      },
    });
  }

  propositions.sort(
    (a, b) => b.score - a.score || a.titre.localeCompare(b.titre, 'fr'),
  );
  return propositions.slice(0, config.maxPropositions);
}
