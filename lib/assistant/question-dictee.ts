/**
 * Une dictée qui interroge Mon assistant au lieu de noter : « Qui sont mes
 * acquéreurs… », « Est-ce qu'on a un vendeur rue Vitruve ? ».
 *
 * Lu sur le texte, sans modèle, dès la fin de la dictée : la réponse part
 * tout de suite. En cas de doute c'est une note — la lecture par le modèle
 * (`intention`) rattrape les questions que ces règles laissent passer, et
 * l'agent peut toujours « Garder comme note ».
 */

/** Au-delà, l'agent raconte quelque chose : c'est une note. */
const LONGUEUR_MAX = 300;

/** Mots d'appel ou d'hésitation en tête de phrase, sans valeur pour trancher. */
const PREAMBULE =
  /^(?:(?:euh|alors|bon|ok|okay|oui|dis|dites|écoute|mon assistant|assistant|priimo)[\s,.!:-]+)+/;

const OUVERTURES = new RegExp(
  '^(?:' +
    [
      'qui',
      'quels?',
      'quelles?',
      'combien',
      "est[- ]ce qu",
      "qu'est[- ]ce",
      "c'est quoi",
      'o[uù] (?:est|sont|en est|en sont|habite|habitent)',
      'as[- ]tu',
      'avez[- ]vous',
      'a[- ]t[- ]on',
      'ai[- ]je',
      'y a[- ]t[- ]il',
      'il y a combien',
      'peux[- ]tu',
      'pouvez[- ]vous',
      'tu (?:peux|as|sais|connais|te souviens)',
      'dis[- ]moi',
      'donne[- ]moi',
      'montre[- ]moi',
      'trouve[- ]moi',
      'retrouve[- ]moi',
      'cherche[- ]moi',
      'liste',
      'fais[- ]moi (?:la|une) liste',
      "(?:on a|j'ai|nous avons) (?:combien|quels?|quelles?)",
    ].join('|') +
    ')(?![\\p{L}\\p{N}])',
  'u',
);

/** Une question rapportée (« elle m'a demandé si… ») reste une note. */
const QUESTION_RAPPORTEE = /\b(?:m'a|nous a|lui ai|leur ai|a)\s+(?:demand|dit)|\bdemande si\b|\bveut savoir\b/;

function nettoyer(texte: string): string {
  return texte
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[«"'(\s]+/, '')
    .toLocaleLowerCase('fr')
    .replace(PREAMBULE, '');
}

export function estQuestionDictee(texte: string): boolean {
  const t = nettoyer(texte);
  if (t.length < 6 || t.length > LONGUEUR_MAX) return false;
  if (OUVERTURES.test(t)) return true;
  // Sinon, une phrase ou deux dont la première se termine par « ? ».
  const phrases = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (phrases.length > 2 || !/\?\s*$/.test(phrases[0] ?? '')) return false;
  return !QUESTION_RAPPORTEE.test(t);
}
