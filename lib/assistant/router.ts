/**
 * Routage déterministe : reconnaître les formes de questions qui reviennent,
 * et aller au SQL sans appeler le moindre modèle.
 *
 * Les formes couvertes viennent du contrat d'interprétation déjà en place
 * (INTERPRET_EXAMPLES) — c'est-à-dire des questions réellement posées. Pour
 * en ajouter, lire d'abord les formulations les plus fréquentes dans
 * `assistant_queries` (écran admin « Assistant »), ne pas deviner.
 *
 * En cas de doute, on rend `null` : le modèle tranche. Un routeur qui se
 * trompe coûte plus cher qu'un appel de modèle.
 */

import type { AssistantIntent } from './intent';
import { EMPTY_INTENT } from './intent';
import { normalizeTexte, significantSearchTokens } from './normalize';
import { estQuestionProduit, type SujetProduit } from './produit';

export type RouteResult = {
  intent: AssistantIntent;
  /** Forme reconnue — journalisée pour mesurer la couverture du routeur. */
  forme: string;
};

const CODE_POSTAL = /\b(\d{5})\b/;

/**
 * `\b` est ASCII : il ne borne ni « activité » ni « à faire ». Ces motifs
 * utilisent des bornes conscientes des accents, sinon la question part au
 * modèle alors que le routeur savait y répondre.
 */
function motif(source: string): RegExp {
  return new RegExp(String.raw`(?<![\p{L}\p{N}])(?:${source})(?![\p{L}\p{N}])`, 'iu');
}

/** « 27 rue Alphonse Penaud », « rue Vitruve », « 8 avenue de la République ». */
const VOIE =
  /\b(\d{1,4}\s*(?:bis|ter|quater)?\s+)?(rue|avenue|av|boulevard|bd|impasse|allée|allee|place|quai|chemin|route|cours|passage|square|villa|voie|cité|cite)\s+([\p{L}\d'’\- ]{2,60})/iu;

/** « cette semaine », « ce mois », « aujourd'hui »… → fenêtre en jours. */
const PERIODES: ReadonlyArray<{ re: RegExp; jours: number }> = [
  { re: motif(String.raw`aujourd\s?'?\s?hui|ce jour`), jours: 1 },
  { re: motif('hier'), jours: 2 },
  { re: motif('cette semaine|ces 7 jours|semaine'), jours: 7 },
  { re: motif('ces (?:15|quinze) jours|quinzaine'), jours: 15 },
  { re: motif('ce mois|du mois|ces 30 jours|mensuel'), jours: 30 },
  { re: motif('ce trimestre|ces 90 jours'), jours: 90 },
];

const NB_JOURS = /\b(\d{1,3})\s+derniers?\s+jours\b/i;

/** Ouvertures d'une question de comptage ou de bilan d'activité. */
const ACTIVITE = motif(
  String.raw`combien|bilan|activit[ée]|r[ée]capitulatif|recap|quoi de neuf|qu'?est[- ]ce qu'?on a fait|qu'?avons[- ]nous fait|qu'?est[- ]ce que j'?ai fait|que dois[- ]je faire|[àa] faire|o[ùu] (?:on )?en (?:est|sommes)[- ]?(?:on|nous)?\s*\??$|mes chiffres|ma semaine|ma journ[ée]e`,
);

/** « qu'est-ce qu'on sait sur / de », « dis-moi sur », « infos sur ». */
const SAVOIR_SUR = motif(
  String.raw`qu'?est[- ]ce qu'?on sait|qu'?est[- ]ce que tu sais|que sait[- ]on|infos?\s+sur|dossier|dis[- ]moi (?:tout )?sur|parle[- ]moi de`,
);

/** « qui s'occupe de », « qui gère », « qui suit », « qui a pris ». */
const QUI_SOCCUPE = motif(
  String.raw`qui\s+(?:s'?occupe|g[èe]re|suit|a pris|est en charge|traite|a rencontr[ée]|a appel[ée])`,
);

/**
 * Marqueurs qui désignent une personne sans la nommer : le nom vient après.
 * « Le téléphone de Martin », « des nouvelles de Sophie Dubois ».
 */
const PERSONNE_SUR = motif(
  String.raw`coordonn[ée]es de|t[ée]l[ée]phone de|num[ée]ro de|des nouvelles de|o[ùu] en (?:est|sommes|sont)[ -]?(?:on|nous)?\s+avec|la fiche de`,
);

/** « qui cherche », « quels acquéreurs », « acquéreurs pour ». */
const ACQUEREUR = motif(
  String.raw`qui cherche|qui recherche|quels?\s+acqu[ée]reurs?|acqu[ée]reurs?\s+(?:pour|sur|dans)|int[ée]ress[ée]s?\s+par|rapprochements?\s+(?:pour|sur)|[àa] qui (?:proposer|montrer)`,
);

function periodeJours(q: string): number | null {
  const explicite = NB_JOURS.exec(q);
  if (explicite) {
    const n = Number(explicite[1]);
    if (Number.isFinite(n) && n > 0) return Math.min(365, n);
  }
  for (const { re, jours } of PERIODES) {
    if (re.test(q)) return jours;
  }
  return null;
}

function codePostal(q: string): string | null {
  return CODE_POSTAL.exec(q)?.[1] ?? null;
}

/** Adresse telle qu'écrite, sans le reste de la phrase. */
function adresse(q: string): string | null {
  const m = VOIE.exec(q);
  if (!m) return null;
  const numero = (m[1] ?? '').trim();
  const type = (m[2] ?? '').trim();
  const nom = (m[3] ?? '')
    .replace(/\s+(?:[àa]|dans|sur|de|du|pour|et|avec)\s+.*$/i, '')
    .replace(/\b\d{5}\b.*$/, '')
    .replace(/[?!.,;:]+\s*$/, '')
    .trim();
  if (nom.length < 2) return null;
  return [numero, type, nom].filter(Boolean).join(' ').replace(/\s+/g, ' ');
}

/**
 * Nom propre après « qui s'occupe de … » / « le dossier … ».
 * On ne devine pas : sans mot significatif restant, on rend null.
 */
function nomApres(q: string, marqueur: RegExp): string | null {
  const m = marqueur.exec(q);
  if (!m || m.index == null) return null;
  const reste = q
    .slice(m.index + m[0].length)
    .replace(/^\s*(?:de |du |des |d'|le |la |les |l')/i, '')
    .replace(/[?!.,;:]+\s*$/, '')
    .trim();
  if (!reste) return null;
  if (VOIE.test(reste)) return null;
  const tokens = significantSearchTokens(reste);
  if (tokens.length === 0) return null;
  return reste.slice(0, 120);
}

function intent(patch: Partial<AssistantIntent>): AssistantIntent {
  return { ...EMPTY_INTENT, ...patch, filtres: { ...EMPTY_INTENT.filtres, ...patch.filtres } };
}

/**
 * Rend une intention sûre, ou null quand seule une lecture par modèle
 * peut trancher.
 */
export function routeQuestion(
  question: string,
  sujetsProduitInjectes?: readonly SujetProduit[],
): RouteResult | null {
  const q = question.trim();
  if (q.length < 3) return null;
  const plat = normalizeTexte(q);
  if (!plat) return null;

  const cp = codePostal(q);
  const voie = adresse(q);
  const jours = periodeJours(q);

  // « À quoi sert le bouton Nouveau » porte sur l'outil, pas sur la base.
  // Une adresse dans la phrase tranche en faveur des données.
  if (!voie && estQuestionProduit(q, sujetsProduitInjectes)) {
    return { forme: 'produit', intent: intent({ type: 'produit' }) };
  }

  // « Qui cherche un appartement dans le 75020 », « acquéreurs pour le 15 rue X »
  if (ACQUEREUR.test(q) && (cp || voie)) {
    return {
      forme: 'acquereurs',
      intent: intent({
        type: 'recherche_acquereur',
        adresse: voie,
        code_postal: cp,
        filtres: { type_contact: 'acquereur', statut_mandat: null },
      }),
    };
  }

  // « Qui s'occupe du 12 rue de la Monnaie » → l'immeuble porte la réponse.
  if (QUI_SOCCUPE.test(q) && voie) {
    return {
      forme: 'qui_soccupe_adresse',
      intent: intent({ type: 'immeuble', adresse: voie, code_postal: cp }),
    };
  }

  // « Qui s'occupe de Martin » → la fiche de la personne.
  if (QUI_SOCCUPE.test(q)) {
    const nom = nomApres(q, QUI_SOCCUPE);
    if (nom) {
      return { forme: 'qui_soccupe_personne', intent: intent({ type: 'personne', nom }) };
    }
  }

  // « Combien de leads ce mois », « bilan de la semaine », « que dois-je faire ».
  if (ACTIVITE.test(q) && !voie) {
    return {
      forme: 'activite',
      intent: intent({ type: 'activite', periode_jours: jours ?? 7 }),
    };
  }

  // « Qu'est-ce qu'on sait sur le 27 rue Alphonse Penaud ».
  if (voie) {
    return {
      forme: SAVOIR_SUR.test(q) ? 'savoir_adresse' : 'adresse',
      intent: intent({ type: 'immeuble', adresse: voie, code_postal: cp }),
    };
  }

  // « Le dossier Dubois », « infos sur Sophie Dubois ».
  if (SAVOIR_SUR.test(q)) {
    const nom = nomApres(q, SAVOIR_SUR);
    if (nom) return { forme: 'savoir_personne', intent: intent({ type: 'personne', nom }) };
  }

  // « Le téléphone de Martin », « des nouvelles de Sophie Dubois ».
  if (PERSONNE_SUR.test(q)) {
    const nom = nomApres(q, PERSONNE_SUR);
    if (nom) return { forme: 'personne', intent: intent({ type: 'personne', nom }) };
  }

  // Un code postal seul, sans autre signal : activité du secteur non couverte.
  return null;
}
