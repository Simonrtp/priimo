/**
 * Une question posée à toute la base visible : « qui sont mes acquéreurs »,
 * « qui veut vendre dans le 11e », « quels biens en exclusivité ».
 *
 * La collecte rend toutes les fiches que l'agent a le droit de voir ; elles
 * partent au modèle en lignes compactes (une fiche par ligne). Le modèle
 * filtre et croise, il ne lit rien d'autre. Les fiches qu'il cite deviennent
 * les sources cliquables sous la réponse.
 */

import type { AssistantSource, CollecteLigne } from './collecte';
import { normalizeTexte } from './normalize';

/**
 * ~60 000 caractères ≈ 15 000 tokens : plusieurs centaines de fiches. Au-delà,
 * les plus anciennes restent de côté et le modèle le sait.
 */
export const BASE_MAX_CHARS = 60_000;
const CHAMP_MAX_CHARS = 220;

/** Envoyé en premier message, identique à chaque appel : rien n'y est interpolé. */
export const BASE_SYSTEM_PROMPT = [
  "Tu es Mon assistant, l'assistant d'un agent immobilier français.",
  "Tu réponds à sa question uniquement à partir des fiches fournies : contacts, biens, notes et prospects. Ce sont toutes les fiches qu'il a le droit de voir.",
  'Tu peux filtrer, compter, comparer et croiser ces fiches.',
  "Tu ne cites aucune personne, adresse, téléphone ou chiffre absent des fiches. Si rien ne correspond, tu le dis en une phrase.",
  'Un contact peut avoir plusieurs rôles (champ autres_roles).',
  'Pour un critère chiffré dit dans la question (budget, pièces, surface), passe les fiches en revue une à une. Un budget convient si budget_max est à 10 % près du montant dit, ou au-dessus. Le nombre de pièces cherché peut n’être écrit que dans le résumé (« un 3 pièces », « T3 »).',
  'Écris les noms tels qu’ils figurent dans les fiches, avec le téléphone quand il aide à agir.',
  'La question est souvent dictée dans la rue : un mot peut être mal transcrit. Retiens le sens le plus probable pour un agent immobilier (« accéder à un bien » veut dire acheter).',
  'Forme de la réponse : une première phrase qui donne le nombre de fiches qui répondent (par exemple « 13 acquéreurs : »), puis au plus dix lignes qui commencent par « — ». Au-delà de dix, les dix plus pertinents. Texte brut : jamais d’astérisque, de dièse, de tableau ni de remarque entre parenthèses à la fin.',
].join('\n');

const ETIQUETTE: Record<CollecteLigne['kind'], string> = {
  contact: 'Contact',
  bien: 'Bien',
  note: 'Note',
  lead: 'Prospect',
  interaction: 'Échange',
};

function valeur(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (Array.isArray(v)) return v.length > 0 ? v.map(String).join(', ') : null;
  if (typeof v === 'boolean') return v ? 'oui' : null;
  let s = String(v).replace(/\s+/g, ' ').trim();
  // Une date ISO se lit au jour près.
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) s = s.slice(0, 10);
  return s.length > CHAMP_MAX_CHARS ? `${s.slice(0, CHAMP_MAX_CHARS)}…` : s;
}

/** Ce qui sert à trier passe en tête ; l'origine technique de la fiche ne sert pas. */
const ORDRE_CHAMPS = [
  'nom',
  'adresse',
  'type',
  'autres_roles',
  'type_bien',
  'prix',
  'surface',
  'pieces',
  'statut_mandat',
  'budget_min',
  'budget_max',
  'pieces_min',
  'surface_min',
  'surface_max',
  'codes_postaux',
  'secteur',
  'resume',
];
const CHAMPS_OMIS = new Set(['source']);

export function ligneCompacte(ligne: CollecteLigne): string {
  const parts = [ETIQUETTE[ligne.kind] ?? ligne.kind];
  const cles = Object.keys(ligne.faits)
    .filter((cle) => !CHAMPS_OMIS.has(cle))
    .sort((a, b) => {
      const ia = ORDRE_CHAMPS.indexOf(a);
      const ib = ORDRE_CHAMPS.indexOf(b);
      return (ia < 0 ? ORDRE_CHAMPS.length : ia) - (ib < 0 ? ORDRE_CHAMPS.length : ib);
    });
  for (const cle of cles) {
    const v = valeur(ligne.faits[cle]);
    if (v !== null) parts.push(`${cle}: ${v}`);
  }
  return parts.join(' | ');
}

/**
 * Les petits modèles glissent parfois du markdown malgré la consigne : la
 * réponse s'affiche en texte brut, sans astérisques ni dièses.
 */
export function texteSansMarkdown(texte: string): string {
  return texte
    .replace(/\*\*|__/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[*•]\s+/gm, '— ');
}

export type TexteBase = { texte: string; lues: number; omises: number };

/** Les fiches dans l'ordre de la collecte, jusqu'au plafond de caractères. */
export function texteBase(lignes: readonly CollecteLigne[], maxChars = BASE_MAX_CHARS): TexteBase {
  const gardees: string[] = [];
  let taille = 0;
  for (const ligne of lignes) {
    const t = ligneCompacte(ligne);
    if (taille + t.length + 1 > maxChars) break;
    gardees.push(t);
    taille += t.length + 1;
  }
  const omises = lignes.length - gardees.length;
  const pied = omises > 0 ? `\n(${omises} fiches plus anciennes non lues, faute de place.)` : '';
  return { texte: gardees.join('\n') + pied, lues: gardees.length, omises };
}

/** « 12 rue Vitruve, 75020 Paris » → « 12 rue vitruve » : ce que la réponse reprend. */
function teteAdresse(adresse: string): string {
  return normalizeTexte(adresse.split(',')[0] ?? adresse);
}

/**
 * Les fiches que la réponse nomme, dans l'ordre où elle les cite. Un nom
 * complet, ou un mot de nom qu'une seule fiche porte (« Rousseau ») ; une
 * adresse par son numéro et sa voie. Les notes ne se citent pas par un nom :
 * elles restent hors des sources.
 */
export function sourcesCitees(
  reponse: string,
  lignes: readonly CollecteLigne[],
  sources: readonly AssistantSource[],
): AssistantSource[] {
  const texte = ` ${normalizeTexte(reponse)} `;
  const contient = (fragment: string) => fragment.length >= 3 && texte.includes(` ${fragment} `);

  // Chaque mot de nom, prénoms compris : « Martin » seul ne désigne personne
  // quand un « Martin Benoît » existe aussi.
  const porteurs = new Map<string, number>();
  for (const l of lignes) {
    if (l.kind !== 'contact') continue;
    for (const mot of new Set(normalizeTexte(String(l.faits.nom ?? '')).split(' ').filter(Boolean))) {
      porteurs.set(mot, (porteurs.get(mot) ?? 0) + 1);
    }
  }
  const unique = (mot: string) => mot.length >= 4 && porteurs.get(mot) === 1;

  const parId = new Map(sources.map((s) => [`${s.kind}:${s.id}`, s]));
  const trouvees: Array<{ source: AssistantSource; position: number }> = [];
  for (const l of lignes) {
    const source = parId.get(`${l.kind}:${l.id}`);
    if (!source) continue;
    let fragment: string | null = null;
    if (l.kind === 'contact') {
      const complet = normalizeTexte(String(l.faits.nom ?? ''));
      const mots = complet.split(' ').filter(Boolean);
      const famille = mots[mots.length - 1] ?? '';
      if (mots.length >= 2 && contient(complet)) fragment = complet;
      else if (unique(famille) && contient(famille)) fragment = famille;
    } else if (l.kind === 'bien' || l.kind === 'lead') {
      const tete = teteAdresse(String(l.faits.adresse ?? ''));
      if (contient(tete)) fragment = tete;
    }
    if (fragment) trouvees.push({ source, position: texte.indexOf(` ${fragment} `) });
  }
  return trouvees.sort((a, b) => a.position - b.position).map((t) => t.source);
}
