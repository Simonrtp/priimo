/**
 * Le brief de porte : ce que l'agent lit en dix secondes devant l'immeuble.
 *
 * Il ne fait que réordonner ce que la fiche parcelle affiche déjà à ce
 * lecteur. Rien ne vient d'ailleurs : pas de diagnostic énergétique (la
 * lettre n'a pas sa place devant la porte, et un DPE récent n'est pas
 * citable), pas de champ interne, pas de note qu'il ne pourrait pas lire.
 *
 * Pur et sans réseau : le serveur s'en sert pour préparer la rédaction, le
 * client pour s'en passer quand elle n'arrive pas.
 */

import type { RecordViewer } from '@/lib/agency/visibility';
import type { ParcelleFiche } from '@/lib/carte/parcelle';
import { prixDeLImmeuble, typeDominant } from '@/lib/carte/parcelle-synthese';
import { toDisplayCompanyName } from '@/lib/lead-person-display';
import { canSeeVoiceNote } from '@/lib/notes/visibility';
import { passeFiltresApproche, passeFiltresPorte, stripAccents } from '@/lib/script-approche-filtres';
import { CONTACT_TYPE_LABELS, type ContactType, type VoiceNoteVisibilite } from '@/types/contact';

/** Monte à chaque changement de règle : les briefs déjà rédigés ne resservent plus. */
export const BRIEF_VERSION = 6;

/** Le bloc de la fiche d'où vient la ligne : un tap y descend. */
export type BlocFiche = 'entete' | 'ici' | 'contacts' | 'ventes' | 'copropriete';

export type CleBrief = 'immeuble' | 'activite' | 'qui' | 'notes' | 'ouverture' | 'question';

export const ORDRE_BRIEF: readonly CleBrief[] = ['immeuble', 'activite', 'qui', 'notes', 'ouverture', 'question'];

export const LIBELLES_BRIEF: Record<CleBrief, string> = {
  immeuble: 'L’immeuble',
  activite: 'L’activité',
  qui: 'Qui voir',
  notes: 'On sait déjà',
  ouverture: 'À dire',
  question: 'À demander',
};

export type LigneBrief = {
  cle: CleBrief;
  texte: string;
  bloc: BlocFiche;
  /** La donnée manque : la ligne le dit, et la rédaction n'y touche pas. */
  manque: boolean;
};

export type Brief = {
  lignes: LigneBrief[];
  /** Faux quand la rédaction n'a pas répondu à temps : ce sont les lignes brutes. */
  redige: boolean;
};

export type NoteBrief = {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  texte: string;
  createdBy: string | null;
  visibilite: VoiceNoteVisibilite;
};

export type FicheBrief = Pick<
  ParcelleFiche,
  | 'horsSecteur'
  | 'batiment'
  | 'coproprietes'
  | 'ventes'
  | 'passages'
  | 'contacts'
  | 'entreprises'
  | 'proprietaires'
  | 'prospects'
>;

const NOTES_REDACTION = 8;
const NOTE_REDACTION_MAX = 600;
const EXTRAIT_NOTE = 120;
const NOMS_QUI_VOIR = 3;

const COMPTEUR = new Intl.NumberFormat('fr-FR');
const DATE_COURTE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

const PASSAGE_LIBELLE: Record<ParcelleFiche['passages'][number]['kind'], string> = {
  rencontre: 'personne rencontrée',
  absent: 'absent',
  passer: 'adresse passée',
};

function pluriel(n: number, mot: string, motPluriel = `${mot}s`): string {
  return `${COMPTEUR.format(n)} ${n > 1 ? motPluriel : mot}`;
}

function majuscule(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Comme la fiche : « 7 312 €/m² ». */
function eurosM2(n: number): string {
  return `${COMPTEUR.format(Math.round(n))} €/m²`;
}

/** « 2 sept. 2026 » ; une date illisible reste telle quelle. */
export function dateBrief(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? DATE_COURTE.format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : iso;
}

function extrait(texte: string, max: number): string {
  const net = texte.replace(/\s+/g, ' ').trim();
  return net.length > max ? `${net.slice(0, max - 1).trimEnd()}…` : net;
}

function typeImmeuble(usage: string | null | undefined): string | null {
  const u = usage?.trim();
  if (!u) return null;
  if (/r[ée]sidentiel\s+collectif/i.test(u)) return 'Immeuble collectif';
  if (/r[ée]sidentiel\s+individuel/i.test(u)) return 'Maison individuelle';
  return u;
}

function ligneImmeuble(fiche: FicheBrief): LigneBrief {
  if (fiche.horsSecteur) {
    return { cle: 'immeuble', texte: 'Hors de nos codes postaux : rien de public à citer ici', bloc: 'entete', manque: true };
  }
  const b = fiche.batiment;
  const copro = fiche.coproprietes;
  const lotsConnus = copro.filter((c) => c.lots != null);
  const lots = lotsConnus.reduce((n, c) => n + (c.lots ?? 0), 0);
  const procedure = copro.some((c) => c.procedureEnCours);
  const morceaux = [
    typeImmeuble(b?.usage),
    b?.anneeConstruction ? `construit en ${b.anneeConstruction}` : null,
    b?.logements ? pluriel(b.logements, 'logement') : null,
    copro.length > 0
      ? `${lots > 0 ? `copropriété de ${pluriel(lots, 'lot')}` : 'copropriété'}${procedure ? ', procédure en cours' : ''}`
      : null,
  ].filter((m): m is string => Boolean(m));
  if (morceaux.length === 0) {
    return { cle: 'immeuble', texte: 'Aucune description publique de l’immeuble', bloc: 'entete', manque: true };
  }
  return {
    cle: 'immeuble',
    texte: majuscule(morceaux.join(' · ')),
    bloc: copro.length > 0 ? 'copropriete' : 'entete',
    manque: false,
  };
}

function ligneActivite(fiche: FicheBrief, maintenant: Date): LigneBrief {
  const prix = prixDeLImmeuble(fiche.ventes, maintenant);
  const ventes = prix
    ? `médiane ${eurosM2(prix.valeur)} ${prix.recent ? `sur ${pluriel(prix.n, 'vente')}` : `depuis ${prix.depuis}`}`
    : fiche.ventes.length > 0
      ? `${pluriel(fiche.ventes.length, 'vente')}, sans prix au m² exploitable`
      : 'aucune vente publiée';
  const p = fiche.passages[0] ?? null;
  const passage = p
    ? `dernier passage le ${dateBrief(p.jour)} (${PASSAGE_LIBELLE[p.kind]}${p.auteur ? `, ${p.auteur}` : ''})`
    : 'aucun passage enregistré';
  return {
    cle: 'activite',
    texte: `${majuscule(ventes)} · ${passage}`,
    bloc: fiche.ventes.length > 0 ? 'ventes' : 'ici',
    manque: fiche.ventes.length === 0 && !p,
  };
}

function libelleType(type: string | null): string | null {
  if (!type) return null;
  return (CONTACT_TYPE_LABELS[type as ContactType] ?? type).toLowerCase();
}

function ligneQui(fiche: FicheBrief): LigneBrief {
  const noms: string[] = [];
  const vus = new Set<string>();
  const ajouter = (nom: string, precision: string | null) => {
    const cle = stripAccents(nom).toLowerCase().trim();
    if (!cle || vus.has(cle)) return;
    vus.add(cle);
    noms.push(precision ? `${nom} (${precision})` : nom);
  };

  for (const c of fiche.contacts) if (c.type === 'gardien') ajouter(c.nom, 'gardien');
  for (const e of fiche.entreprises) {
    if (e.categorie === 'commerce') ajouter(toDisplayCompanyName(e.nom), e.activite?.trim().toLowerCase() || 'commerce');
  }
  for (const c of fiche.contacts) if (c.type !== 'gardien') ajouter(c.nom, libelleType(c.type));
  for (const e of fiche.entreprises) {
    if (e.categorie !== 'commerce') ajouter(toDisplayCompanyName(e.nom), e.activite?.trim().toLowerCase() || null);
  }
  for (const p of fiche.proprietaires) {
    if (p.genre !== 'copropriete') ajouter(toDisplayCompanyName(p.nom), 'propriétaire');
  }
  for (const p of fiche.prospects) if (p.entreprise) ajouter(toDisplayCompanyName(p.entreprise), 'propriétaire');

  if (noms.length === 0) {
    return { cle: 'qui', texte: 'Aucun nom connu ici', bloc: 'contacts', manque: true };
  }
  const reste = noms.length - NOMS_QUI_VOIR;
  return {
    cle: 'qui',
    texte: `${noms.slice(0, NOMS_QUI_VOIR).join(' · ')}${reste > 0 ? ` · ${pluriel(reste, 'autre')}` : ''}`,
    bloc: 'contacts',
    manque: false,
  };
}

/** Les notes que ce lecteur peut ouvrir dans la fiche, la plus récente d'abord. */
export function notesVisibles(notes: readonly NoteBrief[], viewer: RecordViewer): NoteBrief[] {
  return notes
    .filter((n) => n.texte.trim() && canSeeVoiceNote(viewer, { visibilite: n.visibilite, createdBy: n.createdBy }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

function ligneNotes(visibles: readonly NoteBrief[] | null): LigneBrief {
  if (visibles === null) {
    return { cle: 'notes', texte: 'Mes notes terrain sont plus bas', bloc: 'ici', manque: true };
  }
  if (visibles.length === 0) {
    return { cle: 'notes', texte: 'Aucune note terrain', bloc: 'ici', manque: true };
  }
  const [derniere] = visibles;
  const autres = visibles.length - 1;
  return {
    cle: 'notes',
    texte: `${dateBrief(derniere!.date)} : « ${extrait(derniere!.texte, EXTRAIT_NOTE)} »${
      autres > 0 ? ` (+${pluriel(autres, 'autre note', 'autres notes')})` : ''
    }`,
    bloc: 'ici',
    manque: false,
  };
}

function ligneOuverture(fiche: FicheBrief, maintenant: Date): LigneBrief {
  const bonjour = 'Bonjour, je m’occupe de l’immobilier dans le quartier.';
  if (!fiche.horsSecteur) {
    const prix = prixDeLImmeuble(fiche.ventes, maintenant);
    if (prix) {
      const type = typeDominant(fiche.ventes);
      const quoi =
        type === 'Appartement'
          ? 'Les derniers appartements vendus dans l’immeuble sont partis'
          : type === 'Maison'
            ? 'Les dernières maisons vendues ici sont parties'
            : 'Les derniers biens vendus dans l’immeuble sont partis';
      return {
        cle: 'ouverture',
        texte: `${bonjour} ${quoi} autour de ${COMPTEUR.format(Math.round(prix.valeur))} € le m² : vous avez un projet de votre côté ?`,
        bloc: 'ventes',
        manque: false,
      };
    }
    if (fiche.ventes.length > 0) {
      return {
        cle: 'ouverture',
        texte: `${bonjour} Il y a eu ${pluriel(fiche.ventes.length, 'vente')} dans l’immeuble : vous avez un projet de votre côté ?`,
        bloc: 'ventes',
        manque: false,
      };
    }
  }
  return {
    cle: 'ouverture',
    texte: `${bonjour} Vous êtes propriétaire dans l’immeuble ?`,
    bloc: 'ventes',
    manque: false,
  };
}

function ligneQuestion(fiche: FicheBrief): LigneBrief {
  const gardien = fiche.contacts.some((c) => c.type === 'gardien');
  const commerce =
    fiche.entreprises.some((e) => e.categorie === 'commerce') || fiche.contacts.some((c) => c.type === 'commercant');
  const texte = gardien
    ? 'Au gardien : savez-vous si un logement va se libérer ou se vendre dans l’immeuble ?'
    : commerce
      ? 'Au commerçant : savez-vous si un logement va se libérer ou se vendre dans l’immeuble ?'
      : 'Au propriétaire : avez-vous un projet pour votre logement dans les mois qui viennent ?';
  return { cle: 'question', texte, bloc: 'contacts', manque: false };
}

/**
 * Les six lignes du brief, telles quelles. `notes` à null : on ne les a pas
 * lues (repli côté client), la ligne renvoie au bloc plutôt que d'affirmer
 * qu'il n'y en a pas.
 */
export function collecterBrief(
  fiche: FicheBrief,
  notes: readonly NoteBrief[] | null,
  viewer: RecordViewer,
  maintenant: Date = new Date(),
): { lignes: LigneBrief[]; notes: NoteBrief[] } {
  const visibles = notes === null ? null : notesVisibles(notes, viewer);
  return {
    lignes: [
      ligneImmeuble(fiche),
      ligneActivite(fiche, maintenant),
      ligneQui(fiche),
      ligneNotes(visibles),
      ligneOuverture(fiche, maintenant),
      ligneQuestion(fiche),
    ],
    notes: visibles ?? [],
  };
}

/**
 * Ce qui décide du texte rédigé, et rien d'autre. Deux lecteurs qui voient
 * la même fiche partagent le brief ; une note, un contact ou une vente de
 * plus et l'empreinte change.
 */
export function sourceEmpreinte(parcelleId: string, lignes: readonly LigneBrief[], notes: readonly NoteBrief[]): string {
  return JSON.stringify({
    v: BRIEF_VERSION,
    p: parcelleId,
    l: lignes.map((l) => [l.cle, l.texte, l.bloc, l.manque]),
    n: notes.slice(0, NOTES_REDACTION).map((n) => [n.id, n.date, n.texte]),
  });
}

/* -------------------------------------------------------------------------- */
/*                                  Rédaction                                 */
/* -------------------------------------------------------------------------- */

export const BRIEF_SYSTEM_PROMPT =
  "Tu prépares un agent immobilier qui va sonner à un immeuble. Tu réécris en français court les lignes fournies, sans rien ajouter : chaque chiffre, chaque nom et chaque date doit déjà figurer dans les lignes ou les notes. Tu n'interprètes pas les chiffres et tu n'en calcules aucun. Tu gardes les chiffres tels quels. Tu ne parles jamais de diagnostic énergétique, de données, de fichier, de score, de signal ni d'algorithme, et tu ne dis jamais d'où vient une information. Tu réponds uniquement en JSON.";

/**
 * Ce que le modèle réécrit : le texte libre des notes, et les deux phrases
 * qui s'y adaptent. Les lignes de faits (immeuble, activité, noms) restent
 * celles de la fiche, mot pour mot : un petit modèle y glisse des « prix
 * moyens du quartier » qui n'existent pas.
 */
const CLES_REDIGEES: readonly CleBrief[] = ['notes', 'ouverture', 'question'];

/** Sans note visible, il n'y a rien à reformuler : pas d'appel. */
export function briefARediger(lignes: readonly LigneBrief[]): boolean {
  return lignes.some((l) => l.cle === 'notes' && !l.manque);
}

const MAX_CARACTERES: Record<CleBrief, number> = {
  immeuble: 140,
  activite: 160,
  qui: 160,
  notes: 220,
  ouverture: 260,
  question: 180,
};

/** Le message envoyé : uniquement les lignes du brief et les notes visibles du lecteur. */
export function promptBrief(lignes: readonly LigneBrief[], notes: readonly NoteBrief[]): string {
  const presentes = lignes.filter((l) => !l.manque);
  const aRediger = presentes.filter((l) => CLES_REDIGEES.includes(l.cle));
  const blocNotes = notes
    .slice(0, NOTES_REDACTION)
    .map((n) => `[${dateBrief(n.date)}] ${extrait(n.texte, NOTE_REDACTION_MAX)}`);
  return [
    'Lignes du brief :',
    ...presentes.map((l) => `- ${l.cle} : ${l.texte}`),
    '',
    blocNotes.length > 0 ? 'Notes terrain de l’agence, de la plus récente à la plus ancienne :' : 'Aucune note terrain.',
    ...blocNotes,
    '',
    `Renvoie ce JSON, avec uniquement ces clés : { ${aRediger.map((l) => `"${l.cle}": string`).join(', ')} }`,
    '',
    'Règles :',
    '- notes : l’essentiel des notes en 200 caractères au plus (qui a été vu, ce qui a été dit, ce qui reste à faire), avec la date utile écrite comme dans les notes (« 9 oct. »). Tu ne donnes à personne un rôle (propriétaire, locataire, gardien, vendeur) que les notes ne lui donnent pas, et tu ne dis pas ce qui manque.',
    '- ouverture : la phrase que l’agent dit à voix haute à la personne qui ouvre, en vouvoyant. Garde le début « Bonjour, je m’occupe de l’immobilier dans le quartier. » et le chiffre de la ligne, avec « autour de » devant un prix. Elle ne révèle rien des notes. Si les notes n’apportent rien pour cette personne, recopie la ligne.',
    '- question : une seule question à poser, adaptée aux notes. Garde le début « Au gardien : », « Au commerçant : » ou « Au propriétaire : » de la ligne fournie.',
    '- Pas de markdown, pas de guillemets autour des lignes.',
  ].join('\n');
}

/** « 7 312 » et « 7312 » sont le même chiffre. */
function chiffres(s: string): string[] {
  return (s.match(/\d+(?:[ \u00a0\u202f]\d{3}(?!\d))*(?:,\d+)?/g) ?? []).map((m) =>
    m.replace(/\D/g, '').replace(/^0+(?=\d)/, ''),
  );
}

const MOTS_LIBRES = new Set(['madame', 'monsieur', 'mme', 'm']);

/** Les mots en capitale au milieu d'une phrase : des noms, qui doivent venir des sources. */
function nomsPropres(s: string): string[] {
  const out: string[] = [];
  const re = /[A-ZÀ-ÖØ-Þ][\p{L}’'-]*/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const avant = s.slice(0, m.index).trimEnd();
    if (!avant || /[.!?:«"(]$/.test(avant)) continue;
    out.push(m[0]);
  }
  return out;
}

function normaliser(s: string): string {
  return stripAccents(s).toLowerCase();
}

/** Une ligne rédigée n'est gardée que si elle ne dit rien de plus que ses sources. */
export function ligneRedigeeAcceptable(cle: CleBrief, texte: string, sources: string): boolean {
  const t = texte.trim();
  if (!t || t.length > MAX_CARACTERES[cle]) return false;
  if (/\bIA\b|intelligence\s+artificielle/i.test(t)) return false;
  if (/\[[^\]]*\]|\{[^}]*\}|\*\*|XXX|\d{4}-\d{2}-\d{2}/.test(t)) return false;
  if (!passeFiltresApproche(t)) return false;
  if ((cle === 'ouverture' || cle === 'question') && !passeFiltresPorte(t)) return false;

  const connus = new Set(chiffres(sources));
  if (chiffres(t).some((c) => !connus.has(c))) return false;

  const source = normaliser(sources);
  for (const nom of nomsPropres(t)) {
    const n = normaliser(nom).replace(/[’'-]+$/, '');
    if (MOTS_LIBRES.has(n)) continue;
    if (!source.includes(n)) return false;
  }
  return true;
}

/**
 * Fusionne la réponse du modèle avec les lignes brutes : chaque ligne
 * refusée, absente ou manquante reste celle de la fiche.
 */
export function appliquerRedaction(
  lignes: readonly LigneBrief[],
  notes: readonly NoteBrief[],
  brut: string,
): Brief {
  let parsed: Record<string, unknown> | null = null;
  try {
    const t = brut.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
    const v = JSON.parse(t) as unknown;
    parsed = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    parsed = null;
  }
  if (!parsed) return { lignes: [...lignes], redige: false };

  const sources = [
    ...lignes.map((l) => l.texte),
    ...notes.slice(0, NOTES_REDACTION).map((n) => `${dateBrief(n.date)} ${extrait(n.texte, NOTE_REDACTION_MAX)}`),
  ].join('\n');

  let acceptees = 0;
  const sortie = lignes.map((ligne) => {
    if (ligne.manque || !CLES_REDIGEES.includes(ligne.cle)) return ligne;
    const propose = parsed![ligne.cle];
    if (typeof propose !== 'string') return ligne;
    const texte = propose
      .replace(/\s+/g, ' ')
      .replace(/(^|[.!?]\s)(?:Aucune?|Pas d[e’'])\s+(?:autres?\s+)?(?:information|précision|détail)s?[^.!?]*[.!?]\s*/gi, '$1')
      .trim();
    if (!ligneRedigeeAcceptable(ligne.cle, texte, sources)) return ligne;
    // Une médiane n'est pas un prix de vente : « autour de » reste.
    if (/autour de/.test(ligne.texte) && /€/.test(texte) && !/autour|environ/i.test(texte)) return ligne;
    // À qui s'adresse la question : le modèle ne le change pas.
    const destinataire = /^Au [^:]+:/.exec(ligne.texte)?.[0];
    if (destinataire && !texte.startsWith(destinataire)) return ligne;
    acceptees += 1;
    return { ...ligne, texte };
  });
  return { lignes: sortie, redige: acceptees > 0 };
}

/** Le texte lu à voix haute par le téléphone. */
export function texteAEcouter(lignes: readonly LigneBrief[]): string {
  return lignes
    .map((l) => {
      const texte = l.texte
        .replace(/€\/m²/g, 'euros le mètre carré')
        .replace(/€ le m²/g, 'euros le mètre carré')
        .replace(/ · /g, ', ')
        .replace(/[«»]/g, '');
      return `${LIBELLES_BRIEF[l.cle]} : ${texte}.`.replace(/([.?!])\.$/, '$1');
    })
    .join(' ');
}
