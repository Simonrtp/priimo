/** Canal d'approche terrain (clés normalisées côté client). */
export type ApproachCanal = 'porte' | 'telephone' | 'courrier';

export type ApproachObjection = {
  objection: string;
  reponse: string;
};

export type ApproachVariante = {
  angle: string | null;
  ouverture: string | null;
  question: string | null;
  objections: ApproachObjection[];
  sortie: string | null;
};

export type ScriptApproche = Partial<Record<ApproachCanal, ApproachVariante>>;

/** Format persisté en base (pipeline + génération on-demand). */
export type ScriptApprocheStored = {
  genere_le: string;
  variantes: ScriptApproche;
};

const CANAL_LABELS: Record<ApproachCanal, string> = {
  porte: 'À la porte',
  telephone: 'Par téléphone',
  courrier: 'Par courrier',
};

/** Ordre d'affichage des onglets. */
export const APPROACH_CANAL_ORDER: ApproachCanal[] = ['porte', 'telephone', 'courrier'];

/** Limite haute — le prompt d'appel doit tenir entier (pas de coupe mid-phrase). */
export const MAX_OUVERTURE_CHARS = 1200;

export function approachCanalLabel(canal: ApproachCanal): string {
  return CANAL_LABELS[canal];
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = asTrimmedString(obj[key]);
    if (value) return value;
  }
  return null;
}

function truncateOuverture(text: string | null): string | null {
  if (!text) return null;
  if (text.length <= MAX_OUVERTURE_CHARS) return text;
  return `${text.slice(0, MAX_OUVERTURE_CHARS - 1).trimEnd()}…`;
}

function parseObjections(raw: unknown): ApproachObjection[] {
  if (!Array.isArray(raw)) return [];
  const out: ApproachObjection[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const objection = pickString(row, ['objection', 'objet', 'reproche', 'title', 'titre']);
    const reponse = pickString(row, ['reponse', 'réponse', 'response', 'answer', 'texte']);
    if (!objection && !reponse) continue;
    out.push({
      objection: objection ?? '',
      reponse: reponse ?? '',
    });
  }
  return out;
}

function parseVariante(raw: unknown): ApproachVariante | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const angle = pickString(obj, ['angle', 'note', 'conseil', 'pour_vous']);
  const ouverture = truncateOuverture(
    pickString(obj, ['ouverture', 'opening', 'script', 'lettre', 'texte']),
  );
  const question = pickString(obj, ['question', 'relance', 'puis']);
  const sortie = pickString(obj, ['sortie', 'closing', 'conclusion', 'conclure']);
  const objections = parseObjections(obj.objections ?? obj.reponses ?? obj.faq);

  if (!angle && !ouverture && !question && !sortie && objections.length === 0) {
    return null;
  }

  return { angle, ouverture, question, objections, sortie };
}

export function normalizeCanalKey(key: string): ApproachCanal | null {
  const k = key.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (
    k === 'porte' ||
    k === 'a_la_porte' ||
    k === 'ala_porte' ||
    k === 'door' ||
    k === 'terrain' ||
    k === 'porte_a_porte'
  ) {
    return 'porte';
  }
  if (k === 'telephone' || k === 'téléphone' || k === 'tel' || k === 'phone' || k === 'appel') {
    return 'telephone';
  }
  if (
    k === 'courrier' ||
    k === 'lettre' ||
    k === 'mail' ||
    k === 'postal' ||
    k === 'courrier_postal'
  ) {
    return 'courrier';
  }
  return null;
}

function parseCanauxFromEntries(
  entries: Iterable<[string, unknown]>,
  into: ScriptApproche,
): void {
  for (const [key, value] of entries) {
    const canal = normalizeCanalKey(key);
    if (!canal) continue;
    const variante = parseVariante(value);
    if (!variante) continue;
    if (!into[canal]) into[canal] = variante;
  }
}

/**
 * Parse défensif de `script_approche` (jsonb).
 * Accepte :
 * - format simple : `{ intro }` ou `{ texte }`
 * - format plat : `{ porte, telephone?, courrier }`
 * - format pipeline / on-demand : `{ genere_le, variantes: { … } }`
 */
export function parseScriptApproche(raw: unknown): ScriptApproche | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      return parseScriptApproche(JSON.parse(raw) as unknown);
    } catch {
      return null;
    }
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;

  const root = raw as Record<string, unknown>;
  const result: ScriptApproche = {};

  const nested = root.variantes;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    parseCanauxFromEntries(Object.entries(nested as Record<string, unknown>), result);
  }

  // Rétrocompat : canaux à la racine (ignore genere_le / variantes / intro).
  parseCanauxFromEntries(Object.entries(root), result);

  // Format simple on-demand : un seul texte d'intro.
  const intro = asTrimmedString(root.intro) ?? asTrimmedString(root.texte);
  if (intro && !result.porte?.ouverture) {
    result.porte = {
      angle: null,
      ouverture: truncateOuverture(intro),
      question: null,
      objections: [],
      sortie: null,
    };
  }

  return Object.keys(result).length > 0 ? result : null;
}

export function listAvailableCanaux(script: ScriptApproche): ApproachCanal[] {
  return APPROACH_CANAL_ORDER.filter((canal) => Boolean(script[canal]));
}

/** Texte unique affiché à l'agent (intro bien) — premier ouverture dispo. */
export function extractApproachIntro(script: ScriptApproche): string | null {
  for (const canal of APPROACH_CANAL_ORDER) {
    const text = script[canal]?.ouverture?.trim();
    if (text) return text;
  }
  return null;
}

/**
 * Met en évidence chiffres / faits clés (**markdown** + détection auto).
 * Retourne des segments pour rendu React (gras = true).
 */
export function emphasizeApproachFacts(
  text: string,
): Array<{ text: string; bold: boolean }> {
  // 1) Honorer le markdown **…**
  const withMd: Array<{ text: string; bold: boolean }> = [];
  const mdRe = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = mdRe.exec(text)) !== null) {
    if (m.index > last) withMd.push({ text: text.slice(last, m.index), bold: false });
    withMd.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) withMd.push({ text: text.slice(last), bold: false });
  if (withMd.length === 0) withMd.push({ text, bold: false });

  // 2) Sur le plain text, gras auto sur chiffres / infos métier.
  const factRe =
    /(?:classe(?:\s+le\s+bien)?\s+en\s+[A-G]|catégorie\s+[A-G]|\ben\s+[A-G]\b|\d+(?:[.,]\d+)?\s*(?:m²|m2|%)|\d+\s*(?:ventes?|ans?)|\d+(?:er|ère|eme|ème)\s*étage|\d+(?:er|ère|eme|ème)\b|20\d{2}|au\s+\d+(?:er|ère|eme|ème)\b)/gi;

  const out: Array<{ text: string; bold: boolean }> = [];
  for (const part of withMd) {
    if (part.bold) {
      out.push(part);
      continue;
    }
    let i = 0;
    factRe.lastIndex = 0;
    let fm: RegExpExecArray | null;
    while ((fm = factRe.exec(part.text)) !== null) {
      if (fm.index > i) out.push({ text: part.text.slice(i, fm.index), bold: false });
      out.push({ text: fm[0], bold: true });
      i = fm.index + fm[0].length;
    }
    if (i < part.text.length) out.push({ text: part.text.slice(i), bold: false });
  }
  return out;
}

/** Version plain (sans **) pour la copie presse-papier. */
export function stripApproachMarkup(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1');
}

/**
 * Sépare « Bonjour …, » du reste pour l’affichage (salut sur sa propre ligne).
 */
export function splitApproachGreeting(text: string): {
  greeting: string | null;
  body: string;
} {
  const trimmed = text.trim();
  const match = trimmed.match(/^(Bonjour\b[^,\n]*),(\s*)/i);
  if (!match) return { greeting: null, body: trimmed };
  const greeting = `${match[1].trim()},`;
  const body = trimmed.slice(match[0].length).replace(/^\n+/, '').trimStart();
  return { greeting, body };
}

/** Texte prêt à copier : salut puis corps à la ligne. */
export function formatApproachForCopy(text: string): string {
  const plain = stripApproachMarkup(text);
  const { greeting, body } = splitApproachGreeting(plain);
  if (!greeting) return plain;
  return body ? `${greeting}\n${body}` : greeting;
}

export function toStoredScriptApproche(script: ScriptApproche): ScriptApprocheStored {
  return {
    genere_le: new Date().toISOString(),
    variantes: script,
  };
}

/** Persistance du format simple (un texte). */
export function toStoredIntro(intro: string): ScriptApprocheStored & { intro: string } {
  const text = truncateOuverture(intro.trim()) ?? intro.trim();
  return {
    genere_le: new Date().toISOString(),
    intro: text,
    variantes: {
      porte: {
        angle: null,
        ouverture: text,
        question: null,
        objections: [],
        sortie: null,
      },
    },
  };
}
