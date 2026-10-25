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

/**
 * Plafond (pas une cible) des pages lues chaque jour par le balayage de nuit,
 * pour tout Priimo, sur un compteur à part de celui des agents. Mesuré le
 * 25/10/2026 : le premier passage d'un code postal en lit ~240 (tout le stock,
 * une fois), une nuit ordinaire ~20 par code postal, ~60 la nuit du balayage
 * complet de SeLoger. 500 laisse passer le premier passage d'un nouveau code
 * postal en une nuit ; ensuite la consommation réelle reste bien en dessous.
 * La limite de la zone Bright Data `priimo_balayage` reste le dernier rempart.
 */
export function plafondBalayageJour(): number {
  return entier('BALAYAGE_PLAFOND_JOUR', 500);
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
