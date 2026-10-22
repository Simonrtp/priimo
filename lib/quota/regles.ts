/**
 * Plafonds quotidiens des services payés à l'appel. Pur ; la réservation est
 * dans reserver.ts.
 *
 * Trois étages : un agent (compte volé, boucle côté client), une agence, tout
 * Priimo (coupe-circuit : quoi qu'il arrive, la facture du jour est bornée).
 */
import { PLAFONDS_IA_JOUR, type UsageIa } from '@/lib/ia/quota-regles';

export type Plafonds = { agent: number; agence: number; global: number };

function entier(nom: string, defaut: number): number {
  const v = Number(process.env[nom]);
  return Number.isInteger(v) && v > 0 ? v : defaut;
}

/**
 * Pages téléchargées par Bright Data (≈ 0,0015 $ l'une). Au plafond global
 * par défaut, la journée la plus chère coûte 0,90 $ (deux demandes en parallèle par lecture, la
 * plus rapide l'emporte : au pire deux pages facturées). Une URL déjà lue ne
 * recompte pas : elle est reprise en base.
 */
export function plafondsLecturePage(): Plafonds {
  return {
    agent: entier('BRIGHTDATA_PLAFOND_AGENT_JOUR', 30),
    agence: entier('BRIGHTDATA_PLAFOND_AGENCE_JOUR', 100),
    global: entier('BRIGHTDATA_PLAFOND_GLOBAL_JOUR', 300),
  };
}

/** Mon assistant qui lit le texte d'une annonce (collé ou téléchargé). */
export const PLAFONDS_LECTURE_ANNONCE: Plafonds = { agent: 60, agence: 200, global: 1000 };

/**
 * Les usages de l'IA déjà plafonnés par agent : l'agence a droit à quatre
 * agents pleins, tout Priimo à vingt-cinq. Au-delà, c'est une anomalie.
 */
export function plafondsIa(usage: UsageIa): Plafonds {
  const agent = PLAFONDS_IA_JOUR[usage];
  return { agent, agence: agent * 4, global: agent * 25 };
}
