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
  "Tu réponds à sa question uniquement à partir des fiches fournies : contacts, biens, notes et prospects (pipeline). Ce sont toutes les fiches qu'il a le droit de voir.",
  'Tu peux filtrer, compter, comparer et croiser ces fiches.',
  "Tu ne cites aucune personne, adresse, téléphone ou chiffre absent des fiches. Si rien ne correspond, tu le dis clairement.",
  'Un contact peut avoir plusieurs rôles (champ autres_roles).',
  'Le champ etape / etape_cle désigne la colonne du pipeline (Pris, Contacté, Rendez-vous, Estimation, Mandat signé, Perdu, Vente) — distinct du statut_mandat d’un bien.',
  'Les comptes donnés en tête des données sont exacts : reprends-les. Quand la question donne un budget, des pièces ou une surface, les acquéreurs restants y répondent déjà (champ correspond) : liste-les tous, « à vérifier » en dernier.',
  'Écris les noms tels qu’ils figurent dans les fiches, avec le téléphone quand il aide à agir.',
  'La question est souvent dictée dans la rue : un mot peut être mal transcrit. Retiens le sens le plus probable pour un agent immobilier (« accéder à un bien » veut dire acheter).',
  'Ton : clair et un peu chaleureux, sans bavardage. Si le message indique une première réponse et un prénom, tu peux commencer par une courte accroche (« Simon, » ou « Bonjour Simon, ») — une seule fois, jamais à chaque tour.',
  'Tu peux suggérer d’ouvrir une fiche ou la colonne pipeline quand ça aide. Tu ne proposes jamais de rappel calendrier ni « je te rappelle demain ».',
  'Forme : une phrase d’ouverture qui donne le nombre (par exemple « Oui — 1 bien en Rendez-vous : »), puis au plus dix lignes qui commencent par « — ». Texte brut : jamais d’astérisque, de dièse, de tableau ni de lien markdown.',
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
  'etape',
  'etape_cle',
  'budget_min',
  'budget_max',
  'correspond',
  'pieces_min',
  'surface_min',
  'surface_max',
  'codes_postaux',
  'secteur',
  'resume',
  'relance_le',
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
    .replace(/^\s*[*•]\s+/gm, '— ')
    .replace(/\*/g, '');
}

/* -------------------------------------------------------------------------- */
/* Critères chiffrés : tranchés par le code, pas par le modèle                 */
/* -------------------------------------------------------------------------- */

/** Un secteur dit : un code postal (« 75011 ») ou un arrondissement (« le 11e »). */
export type LieuDit = { cp: string | null; arrondissement: number | null; libelle: string };

export type CriteresDits = {
  budget: number | null;
  pieces: number | null;
  surface: number | null;
  lieu: LieuDit | null;
};

const NOMBRES: Record<string, number> = {
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
};

function entier(brut: string): number {
  return Number(brut.replace(/[\s.  ]/g, ''));
}

/** « 450 000 euros », « 450k », « 1,2 million », « budget de 380000 ». */
function budgetDit(q: string): number | null {
  const million = /(\d+(?:[.,]\d+)?)\s*millions?/.exec(q);
  if (million) return Math.round(parseFloat(million[1]!.replace(',', '.')) * 1_000_000);
  const kilo = /(?<![\d.,])(\d{2,4})\s*k(?:€|\b)/.exec(q);
  if (kilo) return entier(kilo[1]!) * 1000;
  const euros = /(\d{1,3}(?:[\s.  ]\d{3})+|\d{5,7})\s*(?:€|euros?)/.exec(q);
  if (euros) return entier(euros[1]!);
  // Un montant groupé par milliers sans unité (« avec 450 000 ») ; un code
  // postal (cinq chiffres collés) n'en est pas un.
  const groupe = /(?<![\d])(\d{1,3}(?:[\s  ]\d{3})+)(?![\d])/.exec(q);
  if (groupe) return entier(groupe[1]!);
  const nu = /(?<![\d])(\d{6,7})(?![\d])/.exec(q);
  return nu ? entier(nu[1]!) : null;
}

/** Tous les nombres de pièces écrits : « un 2 pièces ou un 3 pièces », « T3 », « studio ». */
export function piecesDans(texte: string): number[] {
  const q = texte.toLocaleLowerCase('fr');
  const out = new Set<number>();
  for (const m of q.matchAll(/(\d|un|une|deux|trois|quatre|cinq|six|sept)\s*pi[eè]ces?/g)) {
    const n = /\d/.test(m[1]!) ? Number(m[1]) : NOMBRES[m[1]!];
    if (n) out.add(n);
  }
  for (const m of q.matchAll(/(?<![\p{L}\d])[tf]\s?([1-7])(?![\p{L}\d])/gu)) out.add(Number(m[1]));
  if (/\bstudios?\b/.test(q)) out.add(1);
  return [...out];
}

export function lieuDit(question: string): LieuDit | null {
  const q = question.toLocaleLowerCase('fr');
  const cp = /(?<![\d])((?:75|77|78|91|92|93|94|95|0[1-9]|[1-8]\d)\d{3})(?![\d])/.exec(q);
  if (cp) {
    const arr = /^750(\d{2})$/.exec(cp[1]!);
    return { cp: cp[1]!, arrondissement: arr ? Number(arr[1]) : null, libelle: cp[1]! };
  }
  const arr = /(?<![\d])(\d{1,2})\s?(?:e|è|eme|ème|er|ère)(?![\p{L}\d])/u.exec(q);
  if (arr && Number(arr[1]) >= 1 && Number(arr[1]) <= 20) {
    const n = Number(arr[1]);
    return { cp: `750${String(n).padStart(2, '0')}`, arrondissement: n, libelle: `${n}e` };
  }
  return null;
}

/** Le texte dit-il ce secteur : « 75011 », « 11e », « 11ème », « Paris 11 » ? */
export function texteDitLieu(texte: string, lieu: LieuDit): boolean {
  const t = texte.toLocaleLowerCase('fr');
  if (lieu.cp && t.includes(lieu.cp)) return true;
  if (lieu.arrondissement === null) return false;
  const n = lieu.arrondissement;
  return (
    new RegExp(String.raw`(?<![\d])${n}\s?(?:e|è|eme|ème|er|ère)(?![\p{L}\d])`, 'u').test(t) ||
    new RegExp(String.raw`paris\s+0?${n}(?![\d])`).test(t)
  );
}

export function criteresDits(question: string): CriteresDits {
  const q = question.toLocaleLowerCase('fr');
  const lieu = lieuDit(q);
  // Un code postal collé n'est pas un budget.
  const budget = budgetDit(lieu?.cp ? q.replace(lieu.cp, ' ') : q);
  const surface = /(\d{2,3})\s*(?:m2|m²|mètres? carrés?)/.exec(q);
  return {
    budget: budget && budget >= 20_000 ? budget : null,
    pieces: piecesDans(q)[0] ?? null,
    surface: surface ? Number(surface[1]) : null,
    lieu,
  };
}

function nombreOuNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function euros(n: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(n)} €`;
}

function estAcquereur(l: CollecteLigne): boolean {
  if (l.kind !== 'contact') return false;
  const roles = Array.isArray(l.faits.autres_roles) ? (l.faits.autres_roles as string[]) : [];
  return l.faits.type === 'acquereur' || roles.includes('acquereur');
}

const CHAMPS_LIEU = ['adresse', 'codes_postaux', 'secteur'] as const;

/**
 * « Dans le 11e » : un bien, un prospect ou une dictée hors du secteur sort ;
 * une fiche de personne reste si elle y habite, y cherche — ou si elle ne
 * dit rien de son secteur (« à vérifier »).
 */
function filtrerParLieu(lignes: readonly CollecteLigne[], lieu: LieuDit): CollecteLigne[] {
  const retenues: CollecteLigne[] = [];
  for (const l of lignes) {
    const textes = CHAMPS_LIEU.map((k) => l.faits[k]).filter((v) => v !== undefined && v !== null && v !== '');
    const dit = textes.some((v) => texteDitLieu(Array.isArray(v) ? v.join(' ') : String(v), lieu));
    if (dit) {
      retenues.push(l);
    } else if (l.kind === 'contact' && textes.length === 0) {
      retenues.push({ ...l, faits: { ...l.faits, secteur_a_verifier: `secteur non précisé (${lieu.libelle} demandé)` } });
    }
  }
  return retenues;
}

/**
 * Une question chiffrée (« un 3 pièces avec 450 000 € ») : les acquéreurs
 * qui n'y répondent pas sont écartés, les autres annotés `correspond` — oui,
 * ou à vérifier quand la fiche ne dit rien du critère. Les petits modèles
 * se trompent sur ces comparaisons ; le code, non.
 */
export function ajusterPourCriteres(lignesBrutes: readonly CollecteLigne[], c: CriteresDits): CollecteLigne[] {
  const lignes = c.lieu ? filtrerParLieu(lignesBrutes, c.lieu) : lignesBrutes;
  if (c.budget === null && c.pieces === null && c.surface === null) return [...lignes];
  const retenues: CollecteLigne[] = [];
  const autres: CollecteLigne[] = [];
  for (const l of lignes) {
    if (!estAcquereur(l)) {
      autres.push(l);
      continue;
    }
    const manques: string[] = [];
    let ecartee = false;
    if (c.budget !== null) {
      const b = nombreOuNull(l.faits.budget_max);
      if (b === null) manques.push('budget');
      else if (b < c.budget * 0.9) ecartee = true;
    }
    if (c.pieces !== null) {
      const min = nombreOuNull(l.faits.pieces_min);
      const dites = piecesDans(`${l.faits.resume ?? ''} ${l.faits.secteur ?? ''}`);
      if (min !== null) ecartee ||= min > c.pieces;
      else if (dites.length > 0) ecartee ||= !dites.includes(c.pieces);
      else manques.push('pièces');
    }
    if (c.surface !== null) {
      const s = nombreOuNull(l.faits.surface_min);
      if (s === null) manques.push('surface');
      else if (s > c.surface * 1.1) ecartee = true;
    }
    if (ecartee) continue;
    retenues.push({
      ...l,
      faits: {
        ...l.faits,
        correspond: manques.length ? `à vérifier (${manques.join(', ')} non précisé)` : 'oui',
      },
    });
  }
  retenues.sort((a, b) => Number(b.faits.correspond === 'oui') - Number(a.faits.correspond === 'oui'));
  return [...retenues, ...autres];
}

/** Les comptes exacts, en tête des données : le modèle ne recompte pas. */
export function enteteLecture(lignes: readonly CollecteLigne[], c: CriteresDits): string {
  const n = (kind: CollecteLigne['kind']) => lignes.filter((l) => l.kind === kind).length;
  const acquereurs = lignes.filter(estAcquereur).length;
  const parts = [
    `${n('contact')} contacts (dont ${acquereurs} acquéreurs)`,
    `${n('bien')} biens`,
    `${n('note')} notes`,
    `${n('lead')} prospects`,
  ];
  const lignesEntete = [`Fiches lues : ${parts.join(', ')}.`];
  const dits = [
    c.budget !== null ? `budget ${euros(c.budget)}` : null,
    c.pieces !== null ? `${c.pieces} pièces` : null,
    c.surface !== null ? `${c.surface} m²` : null,
    c.lieu ? `secteur ${c.lieu.libelle}` : null,
  ].filter(Boolean);
  if (dits.length) {
    lignesEntete.push(
      `Critères de la question : ${dits.join(', ')}. Seuls les acquéreurs qui y répondent restent dans les fiches ; le champ correspond le précise. Ils sont ${acquereurs}.`,
    );
  }
  return lignesEntete.join('\n');
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
