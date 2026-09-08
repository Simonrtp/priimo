import {
  compteursAgence,
  compteursFenetre,
  compteursSemaine,
  type JournalActivite,
  type LecturesJournal,
} from './derive';
import { entonnoirCohorte, type EtapeEntonnoir } from './entonnoir';
import { objectifsEffectifs, type ObjectifRow } from './objectifs';
import {
  cascadeRatios,
  FENETRE_SEMAINES,
  type EtapesConversion,
  type Ratios,
  type ReferenceMetier,
} from './ratios';
import {
  dateDebut,
  fenetreSemaines,
  intervalleDecale,
  moisDe,
  nombreDeJours,
  semaineDe,
  semainePrecedente,
  type Intervalle,
  type Periode,
  type Semaine,
} from './semaines';
import {
  ACTIVITES,
  FAMILLES_ACTIVITE,
  LIBELLE_ACTIVITE,
  PROVENANCE_ACTIVITE,
  SOURCE_PAR_ACTIVITE,
  type Activite,
  type Compteur,
  type EtatSource,
} from './types';

/**
 * Le bilan d'un collaborateur sur une semaine : les six compteurs, leurs
 * objectifs, leur source, l'entonnoir, et les ratios avec le niveau retenu.
 *
 * C'est la fonction que l'écran Accueil consomme. Elle est pure : on lui passe
 * le journal déjà chargé, elle ne connaît pas Supabase. La lecture vit dans
 * lib/queries/activite.ts.
 *
 * L'entonnoir est calculé sur la MÊME fenêtre que les ratios. Les faire diverger
 * ferait dire deux choses différentes à la phrase du haut et au dessin du bas,
 * et c'est le dessin qu'on croirait.
 */

export type JourActivite = {
  jour: string;
  compteurs: Record<Activite, number>;
};

export type BilanSemaine = {
  profileId: string;
  periode: Periode;
  /** L'intervalle réellement analysé. Égal à `semaine` en période hebdomadaire. */
  intervalle: Intervalle;
  semaine: Semaine;
  /** Les six compteurs, dans l'ordre de `ACTIVITES`. */
  compteurs: Compteur[];
  /** Les cinq familles affichées en cartes sur l'Accueil. */
  familles: Compteur[];
  /** Progression pondérée de la semaine, 0 à 100. */
  progressionHebdo: number;
  mandatsDuMois: { valeur: number; objectif: number; mois: Intervalle };
  ratios: Ratios;
  /**
   * Entonnoir par cohorte sur les 12 semaines glissantes — même fenêtre que les
   * ratios, pour que la phrase du haut et le dessin du bas parlent du même
   * échantillon.
   */
  entonnoir: EtapeEntonnoir[];
  /** La fenêtre de l'entonnoir et des ratios, pour l'annoncer à l'écran. */
  fenetreRatios: Intervalle;
  /** État de chaque source — consommé par `phrasePilotage`. */
  etatsSource: Record<Activite, EtatSource>;
  /** Cumuls personnels de la fenêtre, pour l'entonnoir et le détail des ratios. */
  fenetrePersonnelle: EtapesConversion;
  /**
   * Un poste par jour, pour le tableau replié. Vide au-delà de 31 jours :
   * un tableau de 365 lignes n'est plus une consultation, c'est un export.
   */
  jours: JourActivite[];
  /** Aucune activité avant cette semaine : l'écran « semaine 1 » s'impose. */
  semaine1: boolean;
  /** Les objectifs affichés sont les défauts, pas ceux du directeur. */
  objectifsParDefaut: boolean;
};

function pourcentage(valeur: number, objectif: number): number {
  if (objectif <= 0) return valeur > 0 ? 100 : 0;
  return Math.min(100, (valeur / objectif) * 100);
}

/**
 * Quelle lecture alimente quel compteur.
 * Les immeubles se nourrissent des trois : ils ne sont indisponibles que si
 * tout est tombé, sinon le chiffre reste partiellement vrai.
 */
const LECTURES_PAR_ACTIVITE: Record<Activite, (keyof LecturesJournal)[]> = {
  contacts_physiques: ['contactsPhysiques'],
  immeubles_prospectes: ['transitions', 'notes', 'contactsPhysiques'],
  contacts_qualifies: ['transitions'],
  estimations: ['transitions'],
  informations_terrain: ['notes'],
  mandats: ['transitions'],
};

function etatSource(
  activite: Activite,
  lectures: LecturesJournal,
  cumulFenetre: number,
): EtatSource {
  const sources = LECTURES_PAR_ACTIVITE[activite];
  if (sources.every((s) => lectures[s] === 'erreur')) return 'indisponible';
  // Rien sur douze semaines : la source fonctionne mais n'a jamais rien produit.
  if (cumulFenetre === 0) return 'muette';
  return 'ok';
}

/** Jours civils parisiens d'un intervalle, bornes incluses. */
function joursDe(intervalle: Intervalle): string[] {
  const out: string[] = [];
  const [y, m, d] = intervalle.debut.split('-').map(Number);
  const total = nombreDeJours(intervalle);
  for (let i = 0; i < total; i += 1) {
    out.push(
      new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + i, 12, 0, 0)).toISOString().slice(0, 10),
    );
  }
  return out;
}

/** Au-delà, le tableau jour par jour cesse d'être lisible. */
const MAX_JOURS_DETAILLES = 31;

/**
 * Combien de semaines « vaut » l'intervalle, pour proratiser des objectifs qui
 * sont posés à la semaine. Un mois de 31 jours vaut 4,43 semaines, pas 4.
 */
function semainesEquivalentes(intervalle: Intervalle): number {
  return nombreDeJours(intervalle) / 7;
}

function versEtapes(compteurs: Record<Activite, number>): EtapesConversion {
  return {
    contacts_physiques: compteurs.contacts_physiques,
    contacts_qualifies: compteurs.contacts_qualifies,
    estimations: compteurs.estimations,
    mandats: compteurs.mandats,
  };
}

export type ParamsBilan = {
  journal: JournalActivite;
  profileId: string;
  /** Les autres membres de l'agence, pour le niveau « moyenne de l'agence ». */
  profileIdsAgence: readonly string[];
  objectifs: readonly ObjectifRow[];
  reference: ReferenceMetier;
  referenceFournie: boolean;
};

/**
 * Bilan sur une période quelconque.
 *
 * Les objectifs sont posés à la semaine ; ils sont proratisés au nombre de
 * semaines que vaut l'intervalle. Les ratios et l'entonnoir, eux, restent sur
 * douze semaines glissantes quelle que soit la période affichée : ce sont des
 * repères de conversion, pas une mesure de la période, et les recalculer sur
 * un seul jour donnerait un ratio de bruit.
 */
export function bilanPeriode(
  params: ParamsBilan & { periode: Periode; intervalle: Intervalle },
): BilanSemaine {
  const {
    journal,
    profileId,
    profileIdsAgence,
    periode,
    intervalle,
    objectifs: objectifRows,
    reference,
    referenceFournie,
  } = params;

  const objectifs = objectifsEffectifs(objectifRows);
  const facteur = semainesEquivalentes(intervalle);
  const precedent = intervalleDecale(periode, intervalle, -1);

  const courante = compteursFenetre({ journal, profileId, fenetre: intervalle });
  const precedente = compteursFenetre({ journal, profileId, fenetre: precedent });

  // Douze semaines glissantes finissant sur la semaine du début de période.
  const semaine = semaineDe(dateDebut(intervalle));
  const fenetre = fenetreSemaines(semaine, FENETRE_SEMAINES);
  const personnel = compteursFenetre({ journal, profileId, fenetre });
  const agence = compteursAgence({ journal, profileIds: profileIdsAgence, fenetre });

  // Avant la période : ce qui distingue un vrai débutant d'une semaine creuse.
  const avant: Intervalle = { debut: fenetre.debut, fin: precedent.fin };
  const historique =
    avant.debut > avant.fin
      ? null
      : compteursFenetre({ journal, profileId, fenetre: avant });
  const semaine1 = historique === null || ACTIVITES.every((a) => historique[a] === 0);

  const etatsSource = {} as Record<Activite, EtatSource>;
  for (const a of ACTIVITES) {
    etatsSource[a] = etatSource(a, journal.lectures, personnel[a]);
  }

  const compteurs: Compteur[] = ACTIVITES.map((activite) => {
    const objectif = Math.max(0, Math.round(objectifs.hebdo[activite] * facteur));
    return {
      activite,
      libelle: LIBELLE_ACTIVITE[activite],
      valeur: courante[activite],
      objectif,
      source: SOURCE_PAR_ACTIVITE[activite],
      provenance: PROVENANCE_ACTIVITE[activite],
      etatSource: etatsSource[activite],
      ecartSemainePrecedente: semaine1 ? null : courante[activite] - precedente[activite],
    };
  });

  const familles = compteurs.filter((c) =>
    (FAMILLES_ACTIVITE as readonly string[]).includes(c.activite),
  );

  // Chaque famille est plafonnée à 100 % avant la moyenne : sans ça, un seul
  // compteur qui explose masquerait quatre familles à zéro.
  const progressionHebdo =
    familles.length === 0
      ? 0
      : Math.round(
          familles.reduce((somme, c) => somme + pourcentage(c.valeur, c.objectif), 0) /
            familles.length,
        );

  const mois = moisDe(dateDebut(intervalle));
  const compteursMois = compteursFenetre({ journal, profileId, fenetre: mois });

  const ratios = cascadeRatios({
    personnel: versEtapes(personnel),
    agence: versEtapes(agence),
    reference,
    referenceFournie,
  });

  const jours: JourActivite[] =
    nombreDeJours(intervalle) > MAX_JOURS_DETAILLES
      ? []
      : joursDe(intervalle).map((jour) => ({
          jour,
          compteurs: compteursSemaine({ journal, profileId, semaine: { debut: jour, fin: jour } }),
        }));

  return {
    profileId,
    periode,
    intervalle,
    semaine,
    compteurs,
    familles,
    progressionHebdo,
    mandatsDuMois: {
      valeur: compteursMois.mandats,
      objectif: objectifs.mandatsMensuel,
      mois,
    },
    ratios,
    entonnoir: entonnoirCohorte({
      transitions: journal.transitions,
      profileId,
      fenetre,
      rangParCle: journal.rangParCle,
    }),
    fenetreRatios: fenetre,
    etatsSource,
    fenetrePersonnelle: versEtapes(personnel),
    jours,
    semaine1,
    objectifsParDefaut: objectifs.parDefaut,
  };
}

/** Cas hebdomadaire — l'entrée historique, conservée telle quelle. */
export function bilanSemaine(params: ParamsBilan & { semaine: Semaine }): BilanSemaine {
  return bilanPeriode({ ...params, periode: 'semaine', intervalle: params.semaine });
}

export type { Activite, Compteur };

/** Les valeurs brutes des six compteurs — entrée de `phrasePilotage`. */
export function valeursDe(bilan: BilanSemaine): Record<Activite, number> {
  const out = {} as Record<Activite, number>;
  for (const c of bilan.compteurs) out[c.activite] = c.valeur;
  return out;
}
