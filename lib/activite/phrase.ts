import { TODAY_WORKDAYS } from '@/lib/today/field';
import type { Ratios } from './ratios';
import { nombreDeJours, type Intervalle, type Periode } from './semaines';
import { ACTIVITES, type Activite, type EtatSource } from './types';

/**
 * La phrase du haut.
 *
 * C'est le seul élément de l'écran qui déclenche une action ; tout le reste la
 * justifie. Elle répond à une question et une seule : qu'est-ce que je fais de
 * plus, sur la période affichée, pour tenir mon rythme de mandats ?
 *
 * Trois principes qui décident de tout le reste du fichier :
 *
 * 1. On remonte l'entonnoir. Dire « il manque deux mandats » n'aide
 *    personne : un mandat ne se décide pas. On cherche donc le premier étage
 *    EN PARTANT DU HAUT où l'agent décroche, parce que c'est le seul sur lequel
 *    il peut agir aujourd'hui.
 *
 * 2. On proratise sur les jours ouvrés écoulés. Comparer un mardi matin à
 *    l'objectif de la semaine entière déclarerait tout le monde en retard tous
 *    les lundis, et la phrase deviendrait un bruit de fond qu'on cesse de lire.
 *
 * 3. Le rythme requis est mis à l'échelle de la période affichée. Les ratios
 *    donnent un besoin hebdomadaire ; le comparer tel quel à un cumul mensuel
 *    ferait passer pour brillant un agent qui traîne.
 *
 * 4. Une source muette n'est jamais un levier. Un compteur qui n'a jamais rien
 *    produit affiche forcément le plus gros retard : le laisser gagner
 *    reviendrait à désigner systématiquement la source cassée comme la chose à
 *    faire. Et si TOUTES les sources sont muettes, il n'y a pas de retard à
 *    annoncer — il y a un démarrage.
 *
 * 5. La phrase ne doit jamais contredire les cartes posées juste en dessous.
 *    Deux règles en découlent :
 *
 *    - Une période où RIEN n'a été compté ne se chiffre pas. Annoncer « il me
 *      manque 1 contact qualifié » au-dessus de cinq compteurs à zéro fait
 *      passer une journée vide pour un détail à rattraper. On dit alors ce
 *      qu'on voit : rien de compté, rien qui rapproche de l'objectif.
 *
 *    - Un seul étage nommé quand trois décrochent est un demi-mensonge. On
 *      annonce l'ampleur, puis le geste par lequel commencer.
 */

export type TonPhrase = 'demarrage' | 'retard' | 'avance' | 'incalculable';

export type PhrasePilotage = {
  texte: string;
  ton: TonPhrase;
  /** L'étage sur lequel agir, pour mettre en avant le compteur correspondant. */
  levier: Activite | null;
  /** Combien il en manque sur l'étage identifié. 0 si l'agent est à jour. */
  manque: number;
};

/** Semaines dans un mois moyen — 52 / 12. */
export const SEMAINES_PAR_MOIS = 52 / 12;

/** Jours ouvrés entre deux jours civils, bornes incluses. */
export function joursOuvres(debut: string, fin: string): number {
  if (debut > fin) return 0;
  const [y, m, d] = debut.split('-').map(Number);
  const total = nombreDeJours({ debut, fin });
  let n = 0;
  for (let i = 0; i < total; i += 1) {
    const jour = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + i, 12, 0, 0));
    if (TODAY_WORKDAYS.includes(jour.getUTCDay())) n += 1;
  }
  return n;
}

/**
 * Part de la période déjà consommée, en jours ouvrés, jour courant compris.
 *
 * Le jour en cours compte : sinon le lundi matin l'objectif attendu vaut zéro,
 * l'agent est déclaré « en avance » avant d'avoir ouvert sa porte, et la phrase
 * perd toute crédibilité au premier usage.
 */
export function fractionEcoulee(intervalle: Intervalle, jourCourant: string): number {
  const total = joursOuvres(intervalle.debut, intervalle.fin);
  if (total === 0) return 1;
  if (jourCourant > intervalle.fin) return 1;
  if (jourCourant < intervalle.debut) return 0;
  return Math.min(1, joursOuvres(intervalle.debut, jourCourant) / total);
}

export type EtageConversion =
  | 'contacts_physiques'
  | 'contacts_qualifies'
  | 'estimations'
  | 'mandats';

const ETAGES: readonly EtageConversion[] = [
  'contacts_physiques',
  'contacts_qualifies',
  'estimations',
  'mandats',
];

/**
 * Volume HEBDOMADAIRE nécessaire à chaque étage pour tenir l'objectif mensuel
 * de mandats, en remontant les ratios.
 *
 * Retourne `null` dès qu'un ratio manque : mieux vaut ne rien dire que
 * d'inventer un chiffre qui aura l'air d'un engagement.
 */
export function rythmeRequis(params: {
  objectifMandatsMois: number;
  ratios: Ratios;
}): Record<EtageConversion, number> | null {
  const { objectifMandatsMois, ratios } = params;
  const { estimationsParMandat, qualifiesParEstimation, physiquesParQualifie } = ratios;
  if (
    estimationsParMandat === null ||
    qualifiesParEstimation === null ||
    physiquesParQualifie === null
  ) {
    return null;
  }

  const mandats = objectifMandatsMois / SEMAINES_PAR_MOIS;
  const estimations = mandats * estimationsParMandat;
  const contacts_qualifies = estimations * qualifiesParEstimation;
  const contacts_physiques = contacts_qualifies * physiquesParQualifie;
  return { mandats, estimations, contacts_qualifies, contacts_physiques };
}

const NOM_ACTION: Record<EtageConversion, { singulier: string; pluriel: string }> = {
  contacts_physiques: {
    singulier: 'contact en porte-à-porte',
    pluriel: 'contacts en porte-à-porte',
  },
  contacts_qualifies: { singulier: 'contact qualifié', pluriel: 'contacts qualifiés' },
  estimations: { singulier: 'estimation', pluriel: 'estimations' },
  mandats: { singulier: 'mandat', pluriel: 'mandats' },
};

/** « cette semaine », « ce mois-ci »… La phrase doit nommer ce qu'elle mesure. */
const QUAND: Record<Periode, string> = {
  jour: 'aujourd’hui',
  semaine: 'cette semaine',
  mois: 'ce mois-ci',
  annee: 'cette année',
};

function accorde(n: number, etage: EtageConversion): string {
  const { singulier, pluriel } = NOM_ACTION[etage];
  return `${n} ${n > 1 ? pluriel : singulier}`;
}

function rythmeMandats(objectif: number): string {
  if (objectif <= 0) return 'mon objectif';
  return objectif === 1
    ? 'mon rythme d’un mandat par mois'
    : `mon rythme de ${objectif} mandats par mois`;
}

export type EntreePhrase = {
  compteurs: Record<Activite, number>;
  objectifMandatsMois: number;
  ratios: Ratios;
  /** La période affichée, telle que la montre le sélecteur. */
  periode: Periode;
  intervalle: Intervalle;
  semaine1: boolean;
  /**
   * État de chaque source. Les étages muets ou indisponibles sont écartés du
   * choix du levier : on ne demande pas à un agent de rattraper un compteur
   * qui n'a jamais rien mesuré.
   */
  etatsSource: Record<Activite, EtatSource>;
  /** Jour civil parisien de référence — permet de tester sans horloge. */
  jourCourant: string;
};

const PHRASE_DEMARRAGE =
  'Première semaine : une sortie sur le terrain, le reste de cet écran se remplit tout seul.';

/** Période vide : le geste n'est pas forcément une sortie — la paperasse non plus. */
const PREMIER_GESTE = 'Je n’ai encore rien fait qui me rapproche de mon objectif.';

export function phrasePilotage(entree: EntreePhrase): PhrasePilotage {
  const {
    compteurs,
    objectifMandatsMois,
    ratios,
    periode,
    intervalle,
    semaine1,
    etatsSource,
    jourCourant,
  } = entree;

  if (semaine1) {
    return { texte: PHRASE_DEMARRAGE, ton: 'demarrage', levier: 'contacts_physiques', manque: 0 };
  }

  // Aucune source vivante : il n'y a rien à rattraper, il y a tout à commencer.
  const etagesMesures = ETAGES.filter((e) => etatsSource[e] === 'ok');
  if (etagesMesures.length === 0) {
    return { texte: PHRASE_DEMARRAGE, ton: 'demarrage', levier: 'contacts_physiques', manque: 0 };
  }

  const hebdo = rythmeRequis({ objectifMandatsMois, ratios });
  if (!hebdo) {
    return {
      texte:
        'Il manque les repères de conversion de mon réseau pour calculer mon rythme. Mes compteurs restent justes.',
      ton: 'incalculable',
      levier: null,
      manque: 0,
    };
  }

  // Le besoin hebdomadaire, ramené à la durée de la période affichée.
  const semainesDeLaPeriode = nombreDeJours(intervalle) / 7;
  const fraction = fractionEcoulee(intervalle, jourCourant);
  const quand = QUAND[periode];

  /** Le volume attendu à cette heure-ci, arrondi comme l'objectif des cartes. */
  const attendu = (etage: EtageConversion) =>
    Math.round(hebdo[etage] * semainesDeLaPeriode * fraction);

  // Pas un chiffre sur la période. Il n'y a rien à rattraper étage par étage :
  // il n'y a rien qui avance vers l'objectif. Le levier reste le haut de
  // l'entonnoir même si sa source est muette — on ne lui reproche aucun
  // retard chiffré, on dit que rien n'a encore servi le rythme.
  //
  // Ton de démarrage, jamais de retard : « rien de compté » se suffit, et une
  // flèche qui pointe vers le bas au-dessus d'une journée pas encore commencée
  // ne fait que sermonner.
  if (ACTIVITES.every((activite) => compteurs[activite] === 0)) {
    return {
      texte: `Rien de compté ${quand}. ${PREMIER_GESTE}`,
      ton: 'demarrage',
      levier: 'contacts_physiques',
      manque: attendu('contacts_physiques'),
    };
  }

  // Du plus haut au plus bas : le premier étage en retard est le seul levier
  // sur lequel l'agent peut encore agir. Les étages muets sont déjà écartés.
  const retards = etagesMesures
    .map((etage) => ({ etage, manque: attendu(etage) - compteurs[etage] }))
    .filter((r) => r.manque > 0);

  const premier = retards[0];
  if (premier) {
    const geste = `${accorde(premier.manque, premier.etage)} ${quand}`;
    return {
      texte:
        retards.length > 1
          ? `${retards.length} étages en retard sur ${rythmeMandats(objectifMandatsMois)}. Je commence par ${geste}.`
          : `Il me manque ${geste} pour tenir ${rythmeMandats(objectifMandatsMois)}.`,
      ton: 'retard',
      levier: premier.etage,
      manque: premier.manque,
    };
  }

  // Tous les étages mesurés tiennent : on chiffre l'avance sur le plus haut
  // d'entre eux, celui qui porte le plus gros volume et donc l'avance la plus
  // lisible.
  const tete = etagesMesures[0]!;
  const avance = Math.floor(compteurs[tete] - hebdo[tete] * semainesDeLaPeriode * fraction);
  if (avance > 0) {
    return {
      texte: `C’est en avance de ${accorde(avance, tete)} sur ${rythmeMandats(objectifMandatsMois)}.`,
      ton: 'avance',
      levier: tete,
      manque: 0,
    };
  }

  return {
    texte: `Pile sur ${rythmeMandats(objectifMandatsMois)}. Rien à rattraper ${quand}.`,
    ton: 'avance',
    levier: null,
    manque: 0,
  };
}
