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

const CANAL_LABELS: Record<ApproachCanal, string> = {
  porte: 'À la porte',
  telephone: 'Par téléphone',
  courrier: 'Par courrier',
};

/** Ordre d'affichage des onglets. */
export const APPROACH_CANAL_ORDER: ApproachCanal[] = ['porte', 'telephone', 'courrier'];

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
  const ouverture = pickString(obj, ['ouverture', 'opening', 'script', 'lettre', 'texte']);
  const question = pickString(obj, ['question', 'relance', 'puis']);
  const sortie = pickString(obj, ['sortie', 'closing', 'conclusion', 'conclure']);
  const objections = parseObjections(obj.objections ?? obj.reponses ?? obj.faq);

  if (!angle && !ouverture && !question && !sortie && objections.length === 0) {
    return null;
  }

  return { angle, ouverture, question, objections, sortie };
}

function normalizeCanalKey(key: string): ApproachCanal | null {
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

/**
 * Parse défensif de `script_approche` (jsonb).
 * Retourne null s'il n'y a aucune variante exploitable.
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

  const result: ScriptApproche = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const canal = normalizeCanalKey(key);
    if (!canal) continue;
    const variante = parseVariante(value);
    if (!variante) continue;
    if (!result[canal]) result[canal] = variante;
  }

  return Object.keys(result).length > 0 ? result : null;
}

export function listAvailableCanaux(script: ScriptApproche): ApproachCanal[] {
  return APPROACH_CANAL_ORDER.filter((canal) => Boolean(script[canal]));
}
