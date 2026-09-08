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
    texte: (a) => `${a}, le prochain mandat commence par la porte que je pousse ce matin.`,
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

function prenomsUtiles(prenoms: readonly string[]): string[] {
  const vus = new Set<string>();
  const out: string[] = [];
  for (const brut of prenoms) {
    const p = brut.trim();
    if (!p || p === 'Sans nom') continue;
    const cle = p.toLocaleLowerCase('fr');
    if (vus.has(cle)) continue;
    vus.add(cle);
    out.push(p);
  }
  return out.sort((a, b) => a.localeCompare(b, 'fr'));
}

/**
 * Une citation pour le jour donné. Les prénoms tournent avec la date
 * pour que ce ne soit pas toujours le même qui soit cité.
 */
export function citationDuJour(params: {
  jour: string;
  prenoms: readonly string[];
}): string {
  const liste = prenomsUtiles(params.prenoms);
  const capacite = liste.length >= 2 ? 2 : liste.length >= 1 ? 1 : 0;
  const candidats = MODELES_CITATION.filter((m) => m.noms <= capacite);
  const modele = candidats[indiceStable(params.jour, candidats.length)] ?? MODELES_CITATION[0]!;

  if (modele.noms === 0 || liste.length === 0) return modele.texte();

  const i = indiceStable(`${params.jour}:a`, liste.length);
  const a = liste[i]!;
  if (modele.noms === 1) return modele.texte(a);

  const j = (i + 1 + indiceStable(`${params.jour}:b`, Math.max(1, liste.length - 1))) % liste.length;
  const b = liste[j] === a ? (liste[(j + 1) % liste.length] ?? a) : liste[j]!;
  return modele.texte(a, b);
}
