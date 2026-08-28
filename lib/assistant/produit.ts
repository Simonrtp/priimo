/**
 * Base de connaissance produit : « à quoi sert le bouton Nouveau »,
 * « que veut dire le score », « c'est quoi la vérification marché ».
 *
 * Aucune collecte SQL. La réponse vient d'un markdown rédigé à la main
 * (`content/assistant/produit.md`), chargé une fois puis gardé en mémoire.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { normalizeTexte } from './normalize';

export type SujetProduit = {
  titre: string;
  /** Écran concerné, pour proposer un lien cliquable. */
  ecran: string | null;
  motsCles: string[];
  corps: string;
};

const FICHIER = join(process.cwd(), 'content', 'assistant', 'produit.md');

/** Deux sujets suffisent à répondre ; au-delà on noie le lecteur. */
export const PRODUIT_MAX_SUJETS = 2;

export function parseProduitMarkdown(markdown: string): SujetProduit[] {
  const sujets: SujetProduit[] = [];
  const blocs = markdown.split(/^##\s+/m).slice(1);

  for (const bloc of blocs) {
    const lignes = bloc.split('\n');
    const titre = (lignes.shift() ?? '').trim();
    if (!titre) continue;

    let ecran: string | null = null;
    const motsCles: string[] = [];
    const corps: string[] = [];

    for (const ligne of lignes) {
      const brut = ligne.trim();
      if (brut.startsWith('Écran:')) {
        ecran = brut.slice('Écran:'.length).trim() || null;
        continue;
      }
      if (brut.startsWith('Mots-clés:')) {
        for (const mot of brut.slice('Mots-clés:'.length).split(',')) {
          const n = normalizeTexte(mot);
          if (n) motsCles.push(n);
        }
        continue;
      }
      corps.push(ligne);
    }

    const texte = corps.join('\n').trim();
    if (!texte) continue;
    sujets.push({ titre, ecran, motsCles, corps: texte });
  }

  return sujets;
}

let cache: SujetProduit[] | null = null;

export function sujetsProduit(): SujetProduit[] {
  if (cache) return cache;
  try {
    cache = parseProduitMarkdown(readFileSync(FICHIER, 'utf8'));
  } catch (error) {
    console.error('[assistant] base produit illisible', error);
    cache = [];
  }
  return cache;
}

/** Un mot-clé retrouvé dans la question vaut d'autant plus qu'il est long. */
function scoreSujet(question: string, sujet: SujetProduit): number {
  const q = ` ${normalizeTexte(question)} `;
  let score = 0;
  for (const mot of sujet.motsCles) {
    if (mot.length < 3) continue;
    if (q.includes(` ${mot} `) || q.includes(` ${mot}`) || q.includes(`${mot} `)) {
      score += mot.includes(' ') ? 4 : 2;
    }
  }
  const titre = normalizeTexte(sujet.titre);
  if (titre && q.includes(titre)) score += 5;
  return score;
}

export type ReponseProduit = {
  sujets: SujetProduit[];
  /** Écrans à proposer en lien, dédupliqués. */
  ecrans: Array<{ titre: string; href: string }>;
};

/** Sujets les plus proches de la question, ou liste vide si rien ne colle. */
export function chercherProduit(
  question: string,
  sujets: readonly SujetProduit[] = sujetsProduit(),
): ReponseProduit {
  const classes = sujets
    .map((sujet) => ({ sujet, score: scoreSujet(question, sujet) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, PRODUIT_MAX_SUJETS)
    .map((row) => row.sujet);

  const ecrans: Array<{ titre: string; href: string }> = [];
  const vus = new Set<string>();
  for (const sujet of classes) {
    if (!sujet.ecran || vus.has(sujet.ecran)) continue;
    vus.add(sujet.ecran);
    ecrans.push({ titre: sujet.titre, href: sujet.ecran });
  }

  return { sujets: classes, ecrans };
}

/** Contexte envoyé au modèle : uniquement les sujets retenus. */
export function contexteProduit(reponse: ReponseProduit): string {
  return reponse.sujets
    .map((s) => `### ${s.titre}\n${s.corps}`)
    .join('\n\n');
}

/**
 * Réponse sans modèle quand un seul sujet ressort : le paragraphe est déjà
 * écrit en français, le reformuler ne fait que coûter un appel.
 */
export function reponseProduitDirecte(reponse: ReponseProduit): string | null {
  if (reponse.sujets.length !== 1) return null;
  return reponse.sujets[0]!.corps;
}

/**
 * Tournures qui portent sur l'outil, pas sur les données.
 * « Qu'est-ce qu'on sait sur… » n'en fait pas partie : c'est une adresse.
 */
const MARQUEUR_PRODUIT =
  /(?<![\p{L}\p{N}])(?:[àa] quoi (?:[çc]a )?sert|[àa] quoi [çc]a sert|comment (?:je )?(?:fais|faire|on fait|[çc]a marche|utiliser|cr[ée]er|ajouter|modifier|trouver)|c'?est quoi|qu'?est[- ]ce que (?:le|la|les|l'|un|une|ce|c'?est)|[çc]a (?:veut dire|sert [àa]) quoi|que (?:veut dire|signifie)|signification|o[ùu] (?:se )?trouve[- ]?(?:t[- ]on|je)?|o[ùu] est le bouton|[àa] quoi correspond|explique|comprends pas|d[ée]finition)(?![\p{L}\p{N}])/iu;

/**
 * Vrai seulement si la question a la forme d'une question produit ET qu'un
 * sujet documenté y répond. Sans sujet, on ne prétend rien savoir.
 */
export function estQuestionProduit(
  question: string,
  sujets: readonly SujetProduit[] = sujetsProduit(),
): boolean {
  if (!MARQUEUR_PRODUIT.test(question)) return false;
  return chercherProduit(question, sujets).sujets.length > 0;
}

export const PRODUIT_SYSTEM_PROMPT =
  "Tu réponds à une question sur le fonctionnement de Priimo, un logiciel de prospection immobilière. Tu t'appuies uniquement sur la documentation fournie : tu n'inventes aucune fonctionnalité, aucun réglage, aucun chiffre. Si la documentation ne répond pas, tu le dis. Tu tutoies l'utilisateur au vouvoiement de politesse : emploie « vous ». Réponse courte, concrète, au maximum cinq phrases. Pas de formule de politesse, pas de liste à puces.";
