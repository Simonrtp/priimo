/**
 * Structuration d'une dictée en propositions — l'agent valide ligne par ligne.
 * Rien n'est créé ici.
 */

import {
  dateParisIso,
  heureParisVersUtc,
  parseIsoDateOnly,
  parseIsoDateTime,
  resolvePromesseEcheance,
  resoudreQuand,
} from '@/lib/notes/date-relative';

import type { ContactType, NoteSourceInfo } from '@/types/contact';
import { repartirRoles } from '@/types/contact';
import { chaineModeles, ecarterModele, MODELES_PROFONDS, MODELES_RAPIDES } from '@/lib/mistral/modeles';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const DELAI_MODELE_RAPIDE_MS = 8_000;
/** Environ dix minutes de parole. Au-delà, on garde le début et la fin. */
const MAX_TRANSCRIPT_CHARS = 12_000;
const MIN_TRANSCRIPT_CHARS = 12;
const MAX_OUTPUT_TOKENS = 1_200;
/** Un modèle qui ne répond pas passe la main au suivant. */
const DELAI_MODELE_MS = 25_000;

export type ExtractedPersonne = {
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  /** Rôle principal ; les autres casquettes dites vont dans `autresTypes`. */
  type: ContactType;
  autresTypes?: ContactType[];
  /** Son lien avec une autre personne citée : « sœur de Simon ». */
  relation?: string | null;
};

export type ExtractedRelance = {
  jours: number;
  libelle: string;
};

export type ExtractedPromesse = {
  intitule: string;
  echeance: string;
};

export type ExtractedRendezVous = {
  debut: string;
  fin: string;
  type: 'visite' | 'estimation' | 'signature' | 'autre';
  lieu: string | null;
};

export type ExtractedVisite = {
  dateVisite: string;
  interet: 'aucun' | 'tiede' | 'chaud' | 'offre' | null;
  retour: string | null;
  contactHint: string | null;
};

export type ActionType = 'rappel' | 'tache' | 'rdv' | 'visite_faite';

/** Un engagement pris dans la dictée. Une note peut en porter plusieurs. */
export type ExtractedAction = {
  type: ActionType;
  intitule: string;
  /** Jour, « AAAA-MM-JJ », à l'heure de Paris. Null si rien n'a été dit. */
  date: string | null;
  /** « HH:MM » si une heure a été dite. */
  heure: string | null;
  /** Nom de la personne concernée, tel qu'il est dit. */
  personne: string | null;
  lieu: string | null;
  rdvType: ExtractedRendezVous['type'] | null;
  interet: ExtractedVisite['interet'];
};

export type StatutMandatDicte = 'mandat_simple' | 'mandat_exclusif' | 'compromis' | 'vendu';

/** Une fiche existante qui change : « il baisse à 450 », « mandat signé ». */
export type ExtractedMiseAJour =
  | { champ: 'prix'; valeur: number; bien: string | null }
  | { champ: 'statut_mandat'; valeur: StatutMandatDicte; bien: string | null };

/** Ce que cherche un acquéreur : alimente sa fiche et le rapprochement. */
export type ExtractedRecherche = {
  personne: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  surfaceMin: number | null;
  roomsMin: number | null;
  villes: string[];
  codesPostaux: string[];
  typeBien: string | null;
};

export type EtapeProspectDictee = 'contacte' | 'rendez_vous' | 'mandat' | 'perdu';

/** Ce que la dictée dit d'un propriétaire prospecté (lead DPE). */
export type ExtractedProspect = {
  etape: EtapeProspectDictee;
  motif: string | null;
};

/** Brouillon d'e-mail : l'agent le relit et l'envoie de sa propre messagerie. */
export type ExtractedEmail = {
  personne: string | null;
  objet: string;
  corps: string;
};

export type NoteIntention = 'note' | 'question';

export type NoteExtraction = {
  personnes: ExtractedPersonne[];
  address: string | null;
  secteur: string | null;
  prix: number | null;
  rooms: number | null;
  surface: number | null;
  sourceInfo: NoteSourceInfo | null;
  relance: ExtractedRelance | null;
  /** Premier rappel/tâche daté — lu par les écrans d'avant les actions multiples. */
  promesse: ExtractedPromesse | null;
  rendezVous: ExtractedRendezVous | null;
  visite: ExtractedVisite | null;
  /** v2 — facultatifs : les notes analysées avant eux se relisent encore. */
  titre?: string | null;
  resume?: string | null;
  intention?: NoteIntention;
  actions?: ExtractedAction[];
  misesAJour?: ExtractedMiseAJour[];
  recherche?: ExtractedRecherche | null;
  prospect?: ExtractedProspect | null;
  email?: ExtractedEmail | null;
  /**
   * Ce que l'agent constate sur place (« ils font un ravalement ») : une
   * information sur l'adresse, pas une chose à faire.
   */
  observations?: string[];
};

export const EMPTY_NOTE_EXTRACTION: NoteExtraction = {
  personnes: [],
  address: null,
  secteur: null,
  prix: null,
  rooms: null,
  surface: null,
  sourceInfo: null,
  relance: null,
  promesse: null,
  rendezVous: null,
  visite: null,
  titre: null,
  resume: null,
  intention: 'note',
  actions: [],
  misesAJour: [],
  recherche: null,
  prospect: null,
  email: null,
  observations: [],
};

/**
 * Aucun nom propre en exemple dans la consigne : un modèle recopie les
 * exemples qu'on lui montre, et un nom inventé dans une fiche contact coûte
 * plus cher en confiance que dix champs laissés vides.
 */
const SYSTEM_PROMPT = [
  "Tu es l'assistant d'un agent immobilier français. Il dicte une note en marchant, souvent décousue, avec des reprises.",
  'Tu la transformes en données structurées pour son CRM. Tu réponds uniquement en JSON.',
  'Ne devine jamais : n’invente aucun nom, aucun chiffre, aucune date, aucun fait.',
  'Tout ce qui n’est pas dit explicitement vaut null ou une liste vide. Ne recopie aucun exemple de la consigne.',
  'Si l’agent se reprend (« non, pardon, 450 »), seule la dernière version compte.',
  'Les valeurs d’énumération s’écrivent exactement comme listées, en minuscules et sans accent.',
].join(' ');

export type PromptOptions = {
  /** Prénom de l'agent, pour signer un brouillon d'e-mail. */
  agentPrenom?: string | null;
};

/**
 * Consigne de la lecture en direct : même JSON, mais le modèle n'écrit que ce
 * qu'il a trouvé. Recopier tout le schéma, champs vides compris, coûtait trois
 * à quatre secondes par lecture — c'est la longueur de la réponse qui fait le
 * temps, pas celle de la question. Ni résumé, ni corps d'e-mail ici : la
 * lecture complète s'en charge.
 */
function buildPromptRapide(transcript: string, noteDate = new Date()): string {
  const ref = dateParisIso(noteDate);
  const jour = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: 'Europe/Paris' }).format(noteDate);
  return [
    `Note dictée le ${ref} (${jour}) :`,
    '"""',
    transcript,
    '"""',
    '',
    'JSON, en omettant toute clé vide ou nulle :',
    '{"titre","intention":"note"|"question","personnes":[{"firstName","lastName","phone","email","types":["vendeur"|"acquereur"|"locataire"|"gardien"|"commercant"],"relation"}],"address","secteur","observations":[],"prix","rooms","surface","source_info":"proprietaire"|"gardien"|"voisin"|"tiers"|"agent","actions":[{"type":"rappel"|"tache"|"rdv"|"visite_faite","intitule","quand","rdv_type":"visite"|"estimation"|"signature"|"autre"}],"mises_a_jour":[{"champ":"prix"|"statut_mandat","valeur","bien"}],"recherche":{"personne","budget_min","budget_max","surface_min","pieces_min","villes":[],"codes_postaux":[]},"prospect":{"etape":"contacte"|"rendez_vous"|"mandat"|"perdu","motif"},"email":{"personne","objet"}}',
    'Règles : rien d’inventé. Dernière version si l’agent se reprend. "intitule" court à l’infinitif avec le nom (« Rappeler Mme Martin »). "quand" = les mots dits (« jeudi à 14h »). "titre" : 3 à 6 mots. Montants en euros entiers (« 300 k » = 300000). "rooms" : T2 = 2. "email" seulement si l’agent dit d’envoyer un mail ou des documents.',
    'Rôles : veut acheter / acquérir → "acquereur" ; veut vendre / vend son bien → "vendeur" ; les deux si elle fait les deux. "observations" : ce que l’agent constate sur place (travaux, ravalement, panneau à vendre, déménagement), en phrase courte — un constat n’est jamais une action.',
    '"relation" : le lien dit entre deux personnes citées, en quelques mots avec le prénom de l’autre (« sœur de Simon », « mari de Mme Martin »). Chaque personne citée par son nom a sa propre entrée, même sans autre information.',
  ].join('\n');
}

function buildPrompt(transcript: string, noteDate = new Date(), opts: PromptOptions = {}): string {
  // Le jour de Paris : à 0h30 en France, la date UTC est encore la veille.
  const ref = dateParisIso(noteDate);
  // Le jour de la semaine évite de compter « jeudi » de travers.
  const jour = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    timeZone: 'Europe/Paris',
  }).format(noteDate);
  const signature = opts.agentPrenom?.trim() || null;
  return [
    `Note dictée le ${ref} (${jour}) :`,
    '"""',
    transcript,
    '"""',
    '',
    'Renvoie ce JSON, mêmes clés, mêmes formes. Omets toute clé vide ou nulle : la réponse doit être courte.',
    '{',
    '  "titre": string|null,',
    '  "resume": string|null,',
    '  "intention": "note"|"question",',
    '  "personnes": [{"firstName": string|null, "lastName": string|null, "phone": string|null, "email": string|null, "types": ["vendeur"|"acquereur"|"locataire"|"gardien"|"commercant"], "relation": string|null}],',
    '  "address": string|null,',
    '  "observations": [string],',
    '  "secteur": string|null,',
    '  "prix": number|null,',
    '  "rooms": number|null,',
    '  "surface": number|null,',
    '  "source_info": "proprietaire"|"gardien"|"voisin"|"tiers"|"agent"|null,',
    '  "actions": [{"type": "rappel"|"tache"|"rdv"|"visite_faite", "intitule": string, "quand": string|null, "date_iso": "AAAA-MM-JJ"|null, "heure": "HH:MM"|null, "personne": string|null, "lieu": string|null, "rdv_type": "visite"|"estimation"|"signature"|"autre"|null, "interet": "aucun"|"tiede"|"chaud"|"offre"|null}],',
    '  "mises_a_jour": [{"champ": "prix"|"statut_mandat", "valeur": number|"mandat_simple"|"mandat_exclusif"|"compromis"|"vendu", "bien": string|null}],',
    '  "recherche": {"personne": string|null, "budget_min": number|null, "budget_max": number|null, "surface_min": number|null, "pieces_min": number|null, "villes": [string], "codes_postaux": [string], "type_bien": string|null}|null,',
    '  "prospect": {"etape": "contacte"|"rendez_vous"|"mandat"|"perdu", "motif": string|null}|null,',
    '  "email": {"personne": string|null, "objet": string, "corps": string}|null',
    '}',
    '',
    'Règles :',
    '- "titre" : 3 à 8 mots qui résument la note (qui, quoi, où). "resume" : une phrase factuelle.',
    '- "intention" = "question" seulement si l’agent pose une question à son assistant (« qu’est-ce qu’on sait sur… », « quand est-ce que… ») au lieu de noter quelque chose.',
    '- "personnes" : tableau, vide s’il n’y a aucun nom. Une personne sans nom ni téléphone ne compte pas. Un rôle seul (« le gardien ») n’est pas un nom.',
    '- "relation" : le lien dit entre cette personne et une autre personne citée, en quelques mots avec le prénom de l’autre (« sœur de Simon », « mari de Mme Martin », « locataire de M. Petit »). Rien de dit → null. Une personne citée seulement par ce lien (« la sœur de Simon » → Simon) a quand même sa propre entrée.',
    '- "types" : toutes les casquettes de la personne, déduites de ce qu’elle veut faire. « veut acheter », « veut acquérir », « cherche un appartement » → "acquereur" ; « veut vendre », « met en vente », « vend son bien » → "vendeur" ; « cherche une location » → "locataire". Quelqu’un qui vend et achète porte les deux. Rien de dit → tableau vide.',
    '- "observations" : les constats faits sur place ou rapportés, sur l’immeuble ou le lieu de la note — travaux, ravalement de façade, échafaudage, panneau « à vendre », déménagement, logement vide, nouveau commerce, changement de syndic. Une phrase courte et factuelle par constat, sans répéter l’adresse (« Ravalement de façade en cours »).',
    '- Un constat n’est jamais une action : « ils font un ravalement » va dans "observations", pas dans "actions". Une action n’existe que si l’agent dit ce qu’il doit faire.',
    '- "actions" : une entrée par engagement distinct. « rappeler X », « relancer X », « le recontacter » → "rappel". « envoyer… », « préparer… », « vérifier… » → "tache". Un rendez-vous futur → "rdv". Une visite qui vient d’avoir lieu → "visite_faite" (date du jour sauf si autre chose est dit).',
    '- "intitule" : court, à l’infinitif, avec le nom de la personne quand il est dit (« Rappeler Mme Martin », « Envoyer les diagnostics à M. Petit »).',
    '- "quand" : les mots exacts dits pour le moment (« jeudi à 14h », « demain matin », « dans deux jours »), ou null.',
    `- Dates relatives (demain, jeudi, dans deux jours, mardi 15h, la semaine prochaine) → date absolue calculée depuis le ${ref}, qui est un ${jour}. « Jeudi » seul désigne le prochain jeudi. « La semaine prochaine » sans jour → le lundi suivant. Pas de date dite → null.`,
    '- "mises_a_jour" : seulement pour un bien déjà suivi dont le prix change (« il baisse à 450 » → prix 450000) ou dont le mandat avance (« mandat exclusif signé », « compromis signé », « c’est vendu »). "bien" = l’adresse ou la description du bien telle qu’elle est dite.',
    '- "recherche" : seulement pour quelqu’un qui cherche à acheter. Montants en euros entiers (« 300 k » = 300000).',
    '- "prospect" : seulement sur un propriétaire démarché. « pas vendeur », « ne vend pas », « déjà vendu avec une autre agence » → "perdu" avec le motif en quelques mots ; « je l’ai eu », « il réfléchit » → "contacte" ; RDV d’estimation obtenu → "rendez_vous" ; mandat obtenu → "mandat".',
    `- "email" : seulement si l’agent dit d’envoyer un e-mail, un mail, des documents ou un récapitulatif. "personne" = à qui l’envoyer, tel que dit (un nom, ou un rôle comme « la vendeuse »). Rédige-le en français, vouvoiement, cinq phrases au plus, sans fait inventé${signature ? `, signé « ${signature} »` : ''}.`,
    '- "address" : UNE chaîne, l’adresse telle qu’elle est dite. "secteur" : le quartier ou l’arrondissement seul.',
    '- "prix" en euros, entier. "rooms" = nombre de pièces (T2 = 2). "surface" en m².',
    '- "source_info" = qui a donné l’information.',
  ].join('\n');
}

function asString(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || s.toLowerCase() === 'null') return null;
  return s.slice(0, max);
}

/** Minuscules sans accent : « Propriétaire » et « acquéreur » retombent sur l'énuméré. */
function sansAccent(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr')
    .trim();
  return s && s !== 'null' ? s : null;
}

/**
 * Un modèle qui rend `{street, city}` au lieu d'une chaîne n'a pas mal compris
 * la note : il a mal compris la consigne. On recolle plutôt que de tout perdre.
 */
function asAdresse(v: unknown): string | null {
  const direct = asString(v, 240);
  if (direct) return direct;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const row = v as Record<string, unknown>;
  const morceaux = [
    asString(row.number, 12) ?? asString(row.buildingNumber, 12),
    asString(row.street, 200) ?? asString(row.voie, 200) ?? asString(row.rue, 200),
    asString(row.postalCode, 12) ?? asString(row.zip, 12) ?? asString(row.codePostal, 12),
    asString(row.city, 80) ?? asString(row.ville, 80),
  ].filter(Boolean);
  if (morceaux.length === 0) return null;
  // Le numéro est souvent déjà dans « street » : on ne le répète pas.
  const recolle = morceaux.join(' ').replace(/\s+/g, ' ').trim();
  return recolle.slice(0, 240);
}

/** Un objet attendu seul arrive parfois en tableau d'un élément. */
function objetUnique(v: unknown): Record<string, unknown> | null {
  const candidat = Array.isArray(v) ? v[0] : v;
  if (!candidat || typeof candidat !== 'object' || Array.isArray(candidat)) return null;
  return candidat as Record<string, unknown>;
}

/** « catherine de villeneuve » → « Catherine de Villeneuve ». */
function capitaliserNom(raw: string): string {
  return raw
    .split(/([\s’'-])/u)
    .map((part) => {
      if (!part || /[\s’'-]/.test(part)) return part;
      // Les particules restent en minuscule quand elles ne commencent pas le nom.
      if (PARTICULES.has(part.toLocaleLowerCase('fr'))) return part.toLocaleLowerCase('fr');
      return part.charAt(0).toLocaleUpperCase('fr') + part.slice(1).toLocaleLowerCase('fr');
    })
    .join('');
}

const PARTICULES = new Set(['de', 'du', 'des', 'la', 'le', 'van', 'von', 'da', 'di', "d'", 'l’']);

/**
 * Mots que le modèle glisse dans un nom quand la note ne nomme personne
 * (« le gardien du 24 » → lastName: "gardien"). Un rôle n'est pas un patronyme.
 */
const ROLES = new Set([
  'gardien',
  'gardienne',
  'proprietaire',
  'proprietaires',
  'voisin',
  'voisine',
  'locataire',
  'vendeur',
  'vendeuse',
  'acquereur',
  'acheteur',
  'client',
  'cliente',
  'syndic',
  'agent',
  'monsieur',
  'madame',
  'inconnu',
  'inconnue',
  'personne',
]);

function estRole(raw: string): boolean {
  return ROLES.has(sansAccent(raw) ?? '');
}

function asInt(v: unknown, max: number): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max) return Math.round(v);
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^\d]/g, ''));
    if (Number.isFinite(n) && n > 0 && n <= max) return Math.round(n);
  }
  return null;
}

/** T2 → 2, « 3 pièces » → 3. */
export function asRooms(v: unknown): number | null {
  if (typeof v === 'string') {
    const t = v.trim().toUpperCase().match(/^T\s*(\d{1,2})$/);
    if (t) return asInt(Number(t[1]), 50);
  }
  return asInt(v, 50);
}

export function lignesFicheNote(
  e: Pick<NoteExtraction, 'address' | 'secteur' | 'prix' | 'rooms' | 'surface'>,
): string[] {
  const bits: string[] = [];
  if (e.rooms) bits.push(e.rooms <= 7 ? `T${e.rooms}` : `${e.rooms} pièces`);
  if (e.surface) bits.push(`${e.surface} m²`);
  if (e.prix) bits.push(`${new Intl.NumberFormat('fr-FR').format(e.prix)} €`);
  const lignes: string[] = [];
  if (bits.length) lignes.push(bits.join(' · '));
  const lieu = [e.address, e.secteur].filter(Boolean).join(' · ');
  if (lieu) lignes.push(lieu);
  return lignes;
}

const TYPES: readonly ContactType[] = [
  'vendeur',
  'acquereur',
  'locataire',
  'gardien',
  'commercant',
  'autre',
];
const SOURCES: readonly NoteSourceInfo[] = ['proprietaire', 'gardien', 'voisin', 'tiers', 'agent'];

/** Une valeur seule ou une liste → une liste. */
function tableauBrut(v: unknown): unknown[] {
  return Array.isArray(v) ? v : v === undefined || v === null ? [] : [v];
}

function parsePersonne(raw: unknown): ExtractedPersonne | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const brutPrenom = asString(row.firstName, 80) ?? '';
  const brutNom = asString(row.lastName, 80) ?? '';
  const phone = asString(row.phone, 40);
  // Un rôle cité sans patronyme ne fait pas un contact : « le gardien » reste
  // dans la note, il n'atterrit pas dans le carnet d'adresses.
  const firstName = estRole(brutPrenom) ? '' : brutPrenom;
  const lastName = estRole(brutNom) ? '' : brutNom;
  if (!firstName && !lastName && !phone) return null;
  // « types » (liste) depuis les rôles multiples ; « type » seul reste compris.
  const dits = [...tableauBrut(row.types), ...tableauBrut(row.type)]
    .map((t) => sansAccent(t))
    .filter((t): t is ContactType => Boolean(t) && (TYPES as readonly string[]).includes(t!));
  const { type, autresTypes } = repartirRoles(dits.length ? dits : ['autre']);
  return {
    firstName: firstName ? capitaliserNom(firstName) : '',
    lastName: lastName ? capitaliserNom(lastName) : '',
    phone,
    email: asString(row.email, 160),
    type,
    autresTypes,
    relation: asString(row.relation, 80),
  };
}

export function parseNoteExtraction(raw: string, refDate = new Date()): NoteExtraction {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ...EMPTY_NOTE_EXTRACTION, personnes: [] };
  }

  const personnesRaw = Array.isArray(parsed.personnes)
    ? parsed.personnes
    : parsed.personnes
      ? [parsed.personnes]
      : [];
  const personnes = personnesRaw.map(parsePersonne).filter((p): p is ExtractedPersonne => p !== null);

  const sourceRaw = sansAccent(parsed.source_info);
  const sourceInfo =
    sourceRaw && (SOURCES as readonly string[]).includes(sourceRaw)
      ? (sourceRaw as NoteSourceInfo)
      : null;

  const jours = asInt(parsed.relance_jours, 365);
  const libelle = asString(parsed.relance_libelle, 160);
  const relance = jours ? { jours, libelle: libelle ?? `Relancer dans ${jours} jours` } : null;

  let promesse: ExtractedPromesse | null = null;
  const promRaw = objetUnique(parsed.promesse);
  if (promRaw) {
    const intitule = asString(promRaw.intitule, 200);
    const echeance =
      parseIsoDateOnly(promRaw.echeance_iso) ??
      parseIsoDateOnly(promRaw.echeance) ??
      (intitule ? resolvePromesseEcheance(intitule, refDate) : null);
    if (intitule && echeance) promesse = { intitule, echeance };
  }

  let rendezVous: ExtractedRendezVous | null = null;
  const rdvRaw = objetUnique(parsed.rendez_vous) ?? objetUnique(parsed.rdv);
  if (rdvRaw) {
    const debut = parseIsoDateTime(rdvRaw.debut_iso) ?? parseIsoDateTime(rdvRaw.debut);
    // Une heure de fin manquante ne doit pas faire disparaître le rendez-vous :
    // une visite dure une heure par défaut, l'agent corrige s'il le faut.
    const fin =
      parseIsoDateTime(rdvRaw.fin_iso) ??
      parseIsoDateTime(rdvRaw.fin) ??
      (debut ? new Date(Date.parse(debut) + 3_600_000).toISOString() : null);
    const typeRaw = sansAccent(rdvRaw.type) ?? 'autre';
    const type = (['visite', 'estimation', 'signature', 'autre'] as const).includes(typeRaw as 'visite')
      ? (typeRaw as ExtractedRendezVous['type'])
      : 'autre';
    const lieu = asString(rdvRaw.lieu, 200);
    if (debut && fin) rendezVous = { debut, fin, type, lieu };
  }

  let visite: ExtractedVisite | null = null;
  const visRaw = objetUnique(parsed.visite);
  if (visRaw) {
    const dateVisite = parseIsoDateTime(visRaw.date_iso) ?? parseIsoDateTime(visRaw.date);
    const retour = asString(visRaw.retour, 500);
    const contactHint = asString(visRaw.contact_hint, 120);
    const interetRaw = sansAccent(visRaw.interet);
    const interet =
      interetRaw && (['aucun', 'tiede', 'chaud', 'offre'] as const).includes(interetRaw as 'aucun')
        ? (interetRaw as ExtractedVisite['interet'])
        : null;
    if (dateVisite) visite = { dateVisite, interet, retour, contactHint };
  }

  const actions = parseActions(parsed.actions, refDate);
  // Les écrans d'avant les actions multiples lisent encore ces trois champs.
  if (!promesse) {
    const premiere = actions.find((a) => (a.type === 'rappel' || a.type === 'tache') && a.date);
    if (premiere?.date) promesse = { intitule: premiere.intitule, echeance: premiere.date };
  }
  if (!rendezVous) {
    const rdv = actions.find((a) => a.type === 'rdv' && a.date);
    if (rdv?.date) rendezVous = { ...creneauAction(rdv), type: rdv.rdvType ?? 'autre', lieu: rdv.lieu };
  }
  if (!visite) {
    const faite = actions.find((a) => a.type === 'visite_faite');
    if (faite) {
      visite = {
        dateVisite: creneauAction({ ...faite, date: faite.date ?? dateParisIso(refDate) }).debut,
        interet: faite.interet,
        retour: null,
        contactHint: faite.personne,
      };
    }
  }

  const intentionRaw = sansAccent(parsed.intention);

  return {
    personnes,
    address: asAdresse(parsed.address),
    secteur: asString(parsed.secteur, 160),
    prix: asInt(parsed.prix, 100_000_000),
    rooms: asRooms(parsed.rooms),
    surface: asInt(parsed.surface, 100_000),
    sourceInfo,
    relance,
    promesse,
    rendezVous,
    visite,
    titre: majuscule(asString(parsed.titre, 90)),
    resume: asString(parsed.resume, 300),
    intention: intentionRaw === 'question' ? 'question' : 'note',
    actions,
    misesAJour: parseMisesAJour(parsed.mises_a_jour),
    recherche: parseRecherche(parsed.recherche),
    prospect: parseProspect(parsed.prospect),
    email: parseEmail(parsed.email),
    observations: parseObservations(parsed.observations),
  };
}

/** Constats sur place : courts, sans doublon, six au plus. */
function parseObservations(v: unknown): string[] {
  const vus = new Set<string>();
  const out: string[] = [];
  const brut = Array.isArray(v) ? v : typeof v === 'string' ? [v] : [];
  for (const raw of brut) {
    const texte = majuscule(asString(raw, 140)?.replace(/[.\s]+$/, '') ?? null);
    const cle = sansAccent(texte);
    if (!texte || !cle || vus.has(cle)) continue;
    vus.add(cle);
    out.push(texte);
    if (out.length >= 6) break;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* v2 : actions multiples, mises à jour, recherche, prospect, e-mail           */
/* -------------------------------------------------------------------------- */

const ACTION_TYPES: readonly ActionType[] = ['rappel', 'tache', 'rdv', 'visite_faite'];
const RDV_TYPES: readonly ExtractedRendezVous['type'][] = ['visite', 'estimation', 'signature', 'autre'];
const INTERETS = ['aucun', 'tiede', 'chaud', 'offre'] as const;
const STATUTS_MANDAT: readonly StatutMandatDicte[] = ['mandat_simple', 'mandat_exclusif', 'compromis', 'vendu'];
const ETAPES_PROSPECT: readonly EtapeProspectDictee[] = ['contacte', 'rendez_vous', 'mandat', 'perdu'];
const MAX_ACTIONS = 8;

function tableau(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  return v && typeof v === 'object' ? [v] : [];
}

/** « 14h30 », « 14:30 », « 9h » → « 14:30 », « 09:00 ». */
export function asHeure(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = v.trim().match(/^(\d{1,2})\s*[:h]\s*(\d{2})?$/i);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Début et fin d'une action datée, à l'heure de Paris. Une heure absente → 10h. */
export function creneauAction(a: Pick<ExtractedAction, 'date' | 'heure'>): { debut: string; fin: string } {
  const [y, mo, d] = (a.date ?? '').split('-').map(Number);
  const [h, mi] = (a.heure ?? '10:00').split(':').map(Number);
  const debut = heureParisVersUtc(y!, mo!, d!, h!, mi!);
  return { debut: debut.toISOString(), fin: new Date(debut.getTime() + 3_600_000).toISOString() };
}

function parseActions(v: unknown, refDate: Date): ExtractedAction[] {
  const out: ExtractedAction[] = [];
  for (const raw of tableau(v)) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const type = sansAccent(r.type) as ActionType | null;
    const intitule = majuscule(asString(r.intitule, 200));
    if (!type || !(ACTION_TYPES as readonly string[]).includes(type) || !intitule) continue;
    // Le jour dit (« jeudi ») se calcule ici : le modèle se trompe de jour.
    const dit = resoudreQuand(asString(r.quand, 80), refDate);
    const date = dit?.date ?? parseIsoDateOnly(r.date_iso) ?? parseIsoDateOnly(r.date);
    const heureDite = dit?.heure ?? null;
    // Un RDV sans jour n'est pas un RDV : on le garde comme tâche à caler.
    const typeFinal: ActionType = type === 'rdv' && !date ? 'tache' : type;
    const rdvRaw = sansAccent(r.rdv_type);
    const interetRaw = sansAccent(r.interet);
    out.push({
      type: typeFinal,
      intitule,
      date,
      heure: heureDite ?? asHeure(r.heure),
      personne: asString(r.personne, 120),
      lieu: asString(r.lieu, 200),
      rdvType:
        typeFinal === 'rdv'
          ? rdvRaw && (RDV_TYPES as readonly string[]).includes(rdvRaw)
            ? (rdvRaw as ExtractedRendezVous['type'])
            : 'autre'
          : null,
      interet:
        interetRaw && (INTERETS as readonly string[]).includes(interetRaw)
          ? (interetRaw as ExtractedVisite['interet'])
          : null,
    });
    if (out.length >= MAX_ACTIONS) break;
  }
  return out;
}

function parseMisesAJour(v: unknown): ExtractedMiseAJour[] {
  const out: ExtractedMiseAJour[] = [];
  for (const raw of tableau(v)) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const champ = sansAccent(r.champ);
    const bien = asString(r.bien, 200);
    if (champ === 'prix') {
      const valeur = asInt(r.valeur, 100_000_000);
      // Sous 10 000 €, c'est un « 450 » dit pour 450 000 que le modèle n'a pas converti.
      if (valeur) out.push({ champ: 'prix', valeur: valeur < 10_000 ? valeur * 1000 : valeur, bien });
    } else if (champ === 'statut_mandat') {
      const valeur = sansAccent(r.valeur)?.replace(/\s+/g, '_');
      if (valeur && (STATUTS_MANDAT as readonly string[]).includes(valeur)) {
        out.push({ champ: 'statut_mandat', valeur: valeur as StatutMandatDicte, bien });
      }
    }
  }
  return out.slice(0, 4);
}

function listeCourte(v: unknown, max: number, motif?: RegExp): string[] {
  return tableau(v)
    .map((x) => (typeof x === 'number' ? String(x) : asString(x, 80)))
    .filter((x): x is string => Boolean(x) && (!motif || motif.test(x!)))
    .slice(0, max);
}

function parseRecherche(v: unknown): ExtractedRecherche | null {
  const r = objetUnique(v);
  if (!r) return null;
  const montant = (x: unknown) => {
    const n = asInt(x, 100_000_000);
    return n && n < 10_000 ? n * 1000 : n;
  };
  const recherche: ExtractedRecherche = {
    personne: asString(r.personne, 120),
    budgetMin: montant(r.budget_min),
    budgetMax: montant(r.budget_max),
    surfaceMin: asInt(r.surface_min, 100_000),
    roomsMin: asRooms(r.pieces_min),
    villes: listeCourte(r.villes, 6).map((v) => majuscule(v) ?? v),
    codesPostaux: listeCourte(r.codes_postaux, 8, /^\d{5}$/),
    typeBien: asString(r.type_bien, 60),
  };
  const utile =
    recherche.budgetMin ||
    recherche.budgetMax ||
    recherche.surfaceMin ||
    recherche.roomsMin ||
    recherche.villes.length ||
    recherche.codesPostaux.length ||
    recherche.typeBien;
  return utile ? recherche : null;
}

function parseProspect(v: unknown): ExtractedProspect | null {
  const r = objetUnique(v);
  if (!r) return null;
  const etape = sansAccent(r.etape)?.replace(/[\s-]+/g, '_');
  if (!etape || !(ETAPES_PROSPECT as readonly string[]).includes(etape)) return null;
  return { etape: etape as EtapeProspectDictee, motif: asString(r.motif, 160) };
}

function parseEmail(v: unknown): ExtractedEmail | null {
  const r = objetUnique(v);
  if (!r) return null;
  const objet = asString(r.objet, 140);
  const corps = typeof r.corps === 'string' ? r.corps.trim().slice(0, 3000) : null;
  if (!objet || !corps) return null;
  return { personne: asString(r.personne, 120), objet, corps };
}

/** « vente t3 nantes » → « Vente t3 nantes » : un titre commence par une capitale. */
function majuscule(v: string | null): string | null {
  if (!v) return v;
  return v.charAt(0).toLocaleUpperCase('fr') + v.slice(1);
}

/** Un modèle rend parfois son JSON entre balises Markdown. */
function extraireJson(content: string): string {
  const t = content.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fence ? fence[1]! : t;
}

/**
 * « profond » : la lecture qui fait foi, après la dictée — le modèle le plus fin.
 * « rapide » : les cartes qui apparaissent pendant que l'agent parle — il faut
 * répondre en une ou deux secondes, la lecture profonde corrigera ensuite.
 */
export type ModeLecture = 'profond' | 'rapide';

/** Modèles à essayer : celui imposé par l'environnement, puis la liste par défaut. */
function modelesAEssayer(mode: ModeLecture): readonly string[] {
  return mode === 'rapide'
    ? chaineModeles(MODELES_RAPIDES, process.env.MISTRAL_MODEL_NOTE_LIVE)
    : chaineModeles(MODELES_PROFONDS, process.env.MISTRAL_MODEL_NOTE);
}

async function demander(
  model: string,
  apiKey: string,
  transcript: string,
  noteDate: Date,
  opts: PromptOptions & { delaiMs: number; rapide?: boolean },
): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(opts.delaiMs),
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: opts.rapide ? 700 : MAX_OUTPUT_TOKENS,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: opts.rapide ? buildPromptRapide(transcript, noteDate) : buildPrompt(transcript, noteDate, opts),
          },
        ],
      }),
    });
  } catch (err) {
    // Délai dépassé ou réseau : le modèle suivant prend le relais.
    console.error('[voice] propositions', model, err instanceof Error ? err.name : 'réseau');
    return null;
  }

  if (!res.ok) {
    // Modèle hors forfait (403 « tier_not_allowed »), inconnu, quota, incident :
    // le suivant de la liste prend le relais. Constaté en test : un forfait sans
    // `mistral-large` rendait 403, et la note entière restait sans lecture.
    const detail = await res.text().catch(() => '');
    console.error('[voice] propositions', model, res.status, detail.slice(0, 160));
    ecarterModele(model, res.status);
    return null;
  }

  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return body.choices?.[0]?.message?.content ?? null;
}

export async function extractNotePropositions(
  transcript: string,
  apiKey: string,
  noteDate = new Date(),
  opts: PromptOptions & { mode?: ModeLecture } = {},
): Promise<NoteExtraction> {
  const trimmed = transcript.trim();
  if (trimmed.length < MIN_TRANSCRIPT_CHARS) return { ...EMPTY_NOTE_EXTRACTION, personnes: [] };

  const capped = borner(trimmed);
  const mode = opts.mode ?? 'profond';
  const delaiMs = mode === 'rapide' ? DELAI_MODELE_RAPIDE_MS : DELAI_MODELE_MS;

  for (const model of modelesAEssayer(mode)) {
    const content = await demander(model, apiKey, capped, noteDate, { ...opts, delaiMs, rapide: mode === 'rapide' });
    if (content) return parseNoteExtraction(extraireJson(content), noteDate);
  }
  throw new Error('extraction_empty');
}

/**
 * Une note très longue garde son début (qui, où) et sa fin (ce qu'on a
 * convenu) : c'est en fin de dictée qu'on dit « je le rappelle jeudi ».
 */
function borner(transcript: string): string {
  if (transcript.length <= MAX_TRANSCRIPT_CHARS) return transcript;
  const moitie = Math.floor(MAX_TRANSCRIPT_CHARS / 2);
  return `${transcript.slice(0, moitie)}
[…]
${transcript.slice(-moitie)}`;
}

/** La relance se compte depuis le jour de la note, pas depuis sa relecture. */
export function relanceAtFromJours(jours: number, noteDate = new Date()): string {
  const at = new Date(noteDate.getTime() + jours * 86_400_000);
  return at.toISOString();
}
