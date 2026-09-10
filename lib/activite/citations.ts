/**
 * Citation du jour — une phrase, pas un conseil inventé chaque rendu.
 * L'indice est dérivé du jour civil parisien : même écran toute la journée.
 */

export type ModeleCitation = {
  /** Combien de prénoms le texte attend. */
  noms: 0 | 1 | 2;
  texte: (a?: string, b?: string) => string;
};

export const MODELES_CITATION: readonly ModeleCitation[] = [
  {
    noms: 0,
    texte: () => 'La régularité d’aujourd’hui fait les mandats de demain.',
  },
  {
    noms: 0,
    texte: () => 'Un immeuble de plus aujourd’hui, c’est un mandat de plus ce mois-ci.',
  },
  {
    noms: 0,
    texte: () => 'Le terrain ne ment pas. On y retourne.',
  },
  {
    noms: 0,
    texte: () => 'Ce n’est pas la grande journée qui compte. C’est celle d’après.',
  },
  {
    noms: 1,
    texte: (a) => `${a}, aujourd’hui c’est mon rythme qui se joue.`,
  },
  {
    noms: 1,
    texte: (a) => `${a} : une sortie de plus, et la semaine change de tête.`,
  },
  {
    noms: 1,
    texte: (a) => `Tiens le cap, ${a}. Les mandats suivent ceux qui reviennent.`,
  },
  {
    noms: 1,
    texte: (a) => `${a}, le prochain mandat commence par la porte que tu pousses ce matin.`,
  },
  {
    noms: 1,
    texte: (a) => `${a}, on compte sur cette sortie. Pas pour un exploit — pour une sortie.`,
  },
  {
    noms: 2,
    texte: (a, b) => `${a} et ${b}, la régularité d’aujourd’hui fait les mandats de demain.`,
  },
  {
    noms: 2,
    texte: (a, b) => `Entre ${a} et ${b}, le terrain n’attend pas. On sort.`,
  },
  {
    noms: 2,
    texte: (a, b) => `${a} relance, ${b} qualifie : c’est comme ça qu’un mandat se construit.`,
  },
  {
    noms: 2,
    texte: (a, b) => `${a}, ${b} — même agence, même rythme. Le mois se joue maintenant.`,
  },
  {
    noms: 2,
    texte: (a, b) => `Aujourd’hui ${a} sort, ${b} enchaîne. Demain, le mandat est déjà plus près.`,
  },
];

function indiceStable(cle: string, modulo: number): number {
  if (modulo <= 0) return 0;
  let n = 0;
  for (let i = 0; i < cle.length; i += 1) n = (n * 31 + cle.charCodeAt(i)) >>> 0;
  return n % modulo;
}

function premierPrenom(prenoms: readonly string[]): string | undefined {
  for (const brut of prenoms) {
    const p = brut.trim();
    if (!p || p === 'Sans nom') continue;
    return p;
  }
  return undefined;
}

/**
 * Une citation pour le jour donné.
 * S’il y a un prénom, c’est celui de l’écran — jamais un collègue tiré au sort.
 */
export function citationDuJour(params: {
  jour: string;
  prenoms: readonly string[];
}): string {
  const moi = premierPrenom(params.prenoms);
  const capacite = moi ? 1 : 0;
  const candidats = MODELES_CITATION.filter((m) => m.noms <= capacite);
  const modele = candidats[indiceStable(params.jour, candidats.length)] ?? MODELES_CITATION[0]!;

  if (modele.noms === 0 || !moi) return modele.texte();
  return modele.texte(moi);
}
