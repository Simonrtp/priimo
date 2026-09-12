/**
 * Citation du jour — une phrase qu'on comprend en la lisant une fois.
 * L'indice est dérivé du jour civil parisien : même écran toute la journée.
 */

export type ModeleCitation = {
  texte: () => string;
};

export const MODELES_CITATION: readonly ModeleCitation[] = [
  { texte: () => 'Aujourd’hui, je sors voir des adresses.' },
  { texte: () => 'Je note ce que je fais, pour m’en souvenir.' },
  { texte: () => 'Je m’occupe d’une chose à la fois.' },
  { texte: () => 'Je commence par une visite.' },
  { texte: () => 'Une visite aujourd’hui, c’est déjà bien.' },
  { texte: () => 'Je retourne voir les adresses en retard.' },
  { texte: () => 'Je m’occupe d’aujourd’hui, pas de toute la semaine.' },
  { texte: () => 'Aujourd’hui je fais du terrain. Les mandats viendront après.' },
  { texte: () => 'Si je n’écris rien, je n’aurai rien à montrer ce soir.' },
  { texte: () => 'Je vais sur place. C’est comme ça qu’un mandat se prépare.' },
  { texte: () => 'Aujourd’hui, je fais le travail que je pourrai compter ce soir.' },
  { texte: () => 'Je ne cherche pas à tout faire. J’en fais un.' },
];

function indiceStable(cle: string, modulo: number): number {
  if (modulo <= 0) return 0;
  let n = 0;
  for (let i = 0; i < cle.length; i += 1) n = (n * 31 + cle.charCodeAt(i)) >>> 0;
  return n % modulo;
}

export function citationDuJour(params: {
  jour: string;
  prenoms?: readonly string[];
}): string {
  const modele = MODELES_CITATION[indiceStable(params.jour, MODELES_CITATION.length)] ?? MODELES_CITATION[0]!;
  return modele.texte();
}
