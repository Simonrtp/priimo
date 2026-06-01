/**
 * Modèle et parsing du JSON `display_signals` exposé au client.
 *
 * Contrat strict :
 *   - On NE LIT JAMAIS `internal_signals` côté navigateur (mécanique
 *     de scoring confidentielle).
 *   - On ne montre AUCUN nombre de points : seulement des familles
 *     descriptives sourcées du pipeline.
 *   - Tous les champs sont défensifs : un payload partiel doit
 *     dégrader proprement et l'UI rester stable.
 */

export interface DisplayItem {
  label: string;
  tooltip: string | null;
}

export interface DpeDisplayFamily {
  /** Lettre A..G normalisée, ou null si inconnue. */
  classe: string | null;
  /** Brut depuis le pipeline (peut être ISO ou déjà formaté). */
  date: string | null;
  ageJours: number | null;
  items: DisplayItem[];
}

export interface CascadeDisplayFamily {
  nbVentes: number | null;
  /** Dates pré-formatées par le pipeline (ex. "04/2025"). */
  dates: string[];
  tooltip: string | null;
}

export interface CoproprieteDisplayFamily {
  items: DisplayItem[];
  tooltip: string | null;
}

export interface EvenementsVieDisplayFamily {
  items: DisplayItem[];
  tooltip: string | null;
}

export interface PlusValueDisplay {
  available: boolean;
}

export interface DisplaySignals {
  dpe: DpeDisplayFamily | null;
  cascade: CascadeDisplayFamily | null;
  copropriete: CoproprieteDisplayFamily | null;
  evenementsVie: EvenementsVieDisplayFamily | null;
  plusValue: PlusValueDisplay | null;
}

export const EMPTY_DISPLAY_SIGNALS: DisplaySignals = {
  dpe: null,
  cascade: null,
  copropriete: null,
  evenementsVie: null,
  plusValue: null,
};

// ─── Helpers défensifs ─────────────────────────────────────────────────

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asBoolean(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return null;
}

function parseItem(raw: unknown): DisplayItem | null {
  const obj = asObject(raw);
  if (!obj) return null;
  const label = asString(obj.label);
  if (!label) return null;
  return { label, tooltip: asString(obj.tooltip) };
}

function parseItems(raw: unknown): DisplayItem[] {
  if (!Array.isArray(raw)) return [];
  const out: DisplayItem[] = [];
  for (const r of raw) {
    const item = parseItem(r);
    if (item) out.push(item);
  }
  return out;
}

// ─── Familles ─────────────────────────────────────────────────────────

function parseDpe(raw: unknown): DpeDisplayFamily | null {
  const obj = asObject(raw);
  if (!obj) return null;
  const classe = asString(obj.classe);
  const date = asString(obj.date);
  const ageJours = asNumber(obj.age_jours);
  const items = parseItems(obj.items);
  if (!classe && !date && ageJours === null && items.length === 0) return null;
  return {
    classe: classe ? classe.toUpperCase().charAt(0) : null,
    date,
    ageJours,
    items,
  };
}

function parseCascade(raw: unknown): CascadeDisplayFamily | null {
  const obj = asObject(raw);
  if (!obj) return null;
  const nbVentes = asNumber(obj.nb_ventes);
  const dates = Array.isArray(obj.dates)
    ? obj.dates.filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
    : [];
  const tooltip = asString(obj.tooltip);
  if (nbVentes === null && dates.length === 0) return null;
  return { nbVentes, dates, tooltip };
}

function parseSimpleItemsFamily(
  raw: unknown,
): { items: DisplayItem[]; tooltip: string | null } | null {
  const obj = asObject(raw);
  if (!obj) return null;
  const items = parseItems(obj.items);
  const tooltip = asString(obj.tooltip);
  if (items.length === 0) return null;
  return { items, tooltip };
}

function parsePlusValue(raw: unknown): PlusValueDisplay | null {
  const obj = asObject(raw);
  if (!obj) return null;
  const available = asBoolean(obj.available);
  if (available === null) return null;
  return { available };
}

// ─── Entrée publique ───────────────────────────────────────────────────

export function parseDisplaySignals(raw: unknown): DisplaySignals {
  const root = asObject(raw);
  if (!root) return EMPTY_DISPLAY_SIGNALS;
  return {
    dpe: parseDpe(root.dpe),
    cascade: parseCascade(root.cascade),
    copropriete: parseSimpleItemsFamily(root.copropriete),
    evenementsVie: parseSimpleItemsFamily(root.evenements_vie),
    plusValue: parsePlusValue(root.plus_value),
  };
}

/** True quand AUCUNE famille (hors plus_value, méta) n'a de contenu. */
export function isDisplaySignalsEmpty(ds: DisplaySignals): boolean {
  return (
    ds.dpe === null &&
    ds.cascade === null &&
    ds.copropriete === null &&
    ds.evenementsVie === null
  );
}

// ─── Formatage léger pour l'UI ────────────────────────────────────────

/**
 * Format compact de la date DPE :
 *   - si ISO (YYYY-MM-DD…) → "DD/MM/YYYY"
 *   - sinon, passe-plat (le pipeline peut déjà l'avoir formatée).
 */
export function formatDpeDateForDisplay(raw: string | null): string | null {
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return raw;
}

/** "il y a {n} j", null si n inconnu. */
export function formatDpeAgeLabel(ageJours: number | null): string | null {
  if (ageJours === null || ageJours < 0) return null;
  return `il y a ${ageJours} j`;
}
