import { daysSinceDpe } from '@/lib/lead-dpe';

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
  /** Titre de section fourni par le pipeline (sinon libellé UI par défaut). */
  label: string | null;
  items: DisplayItem[];
  tooltip: string | null;
}

export interface EntrepriseDisplayFamily {
  sciName: string | null;
  siren: string | null;
  eventType: string | null;
  eventDate: string | null;
  items: DisplayItem[];
  /** Présent côté pipeline ; non affiché (enrichissement Pappers = bloc dirigeant). */
  enrichmentPappers: unknown;
}

export interface GenericDisplayFamily {
  key: string;
  title: string;
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
  entreprise: EntrepriseDisplayFamily | null;
  /** Familles futures non typées explicitement (clé JSON → section générique). */
  extraFamilies: GenericDisplayFamily[];
  plusValue: PlusValueDisplay | null;
}

export const EMPTY_DISPLAY_SIGNALS: DisplaySignals = {
  dpe: null,
  cascade: null,
  copropriete: null,
  evenementsVie: null,
  entreprise: null,
  extraFamilies: [],
  plusValue: null,
};

/** Clés JSON connues (hors méta filtrage). */
const PARSED_FAMILY_KEYS = new Set([
  'dpe',
  'cascade',
  'copropriete',
  'evenements_vie',
  'entreprise',
  'plus_value',
]);

const DEFAULT_FAMILY_TITLES: Record<string, string> = {
  dpe: 'DPE',
  cascade: 'Cascade de vente',
  copropriete: 'Copropriété',
  evenements_vie: 'Événements de vie',
  entreprise: 'Événement société',
};

export type DisplaySection =
  | { kind: 'dpe'; family: DpeDisplayFamily }
  | { kind: 'cascade'; family: CascadeDisplayFamily }
  | { kind: 'copropriete'; family: CoproprieteDisplayFamily }
  | { kind: 'evenements_vie'; family: EvenementsVieDisplayFamily }
  | { kind: 'entreprise'; family: EntrepriseDisplayFamily }
  | { kind: 'generic'; family: GenericDisplayFamily };

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

function humanizeFamilyKey(key: string): string {
  return (
    DEFAULT_FAMILY_TITLES[key] ??
    key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
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
  if (nbVentes === null && dates.length === 0 && !tooltip) return null;
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

function parseEvenementsVie(raw: unknown): EvenementsVieDisplayFamily | null {
  const obj = asObject(raw);
  if (!obj) return null;
  const items = parseItems(obj.items);
  const label = asString(obj.label);
  const tooltip = asString(obj.tooltip);
  if (items.length === 0 && !label) return null;
  return { label, items, tooltip };
}

function parseEntreprise(raw: unknown): EntrepriseDisplayFamily | null {
  const obj = asObject(raw);
  if (!obj) return null;
  const sciName = asString(obj.sci_name);
  const siren = asString(obj.siren);
  const eventType = asString(obj.event_type);
  const eventDate = asString(obj.event_date);
  const items = parseItems(obj.items);
  const enrichmentPappers = obj.enrichment_pappers ?? null;
  if (!sciName && !siren && !eventType && !eventDate && items.length === 0) return null;
  return {
    sciName,
    siren,
    eventType,
    eventDate,
    items,
    enrichmentPappers,
  };
}

function parseGenericFamily(key: string, raw: unknown): GenericDisplayFamily | null {
  const obj = asObject(raw);
  if (!obj) return null;
  const items = parseItems(obj.items);
  const tooltip = asString(obj.tooltip);
  const title = asString(obj.label) ?? humanizeFamilyKey(key);
  if (items.length === 0) return null;
  return { key, title, items, tooltip };
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

  const extraFamilies: GenericDisplayFamily[] = [];
  for (const [key, value] of Object.entries(root)) {
    if (PARSED_FAMILY_KEYS.has(key) || value == null) continue;
    const generic = parseGenericFamily(key, value);
    if (generic) extraFamilies.push(generic);
  }

  return {
    dpe: parseDpe(root.dpe),
    cascade: parseCascade(root.cascade),
    copropriete: parseSimpleItemsFamily(root.copropriete),
    evenementsVie: parseEvenementsVie(root.evenements_vie),
    entreprise: parseEntreprise(root.entreprise),
    extraFamilies,
    plusValue: parsePlusValue(root.plus_value),
  };
}

/** Sections affichables dans l'ordre produit (familles connues puis génériques). */
export function getDisplaySections(ds: DisplaySignals): DisplaySection[] {
  const sections: DisplaySection[] = [];
  if (ds.dpe) sections.push({ kind: 'dpe', family: ds.dpe });
  if (ds.cascade) sections.push({ kind: 'cascade', family: ds.cascade });
  if (ds.copropriete) sections.push({ kind: 'copropriete', family: ds.copropriete });
  if (ds.evenementsVie) sections.push({ kind: 'evenements_vie', family: ds.evenementsVie });
  if (ds.entreprise) sections.push({ kind: 'entreprise', family: ds.entreprise });
  for (const family of ds.extraFamilies) {
    sections.push({ kind: 'generic', family });
  }
  return sections;
}

/** True quand aucune famille affichable (hors plus_value, méta). */
export function isDisplaySignalsEmpty(ds: DisplaySignals): boolean {
  return getDisplaySections(ds).length === 0;
}

/** Items entreprise à lister sous le titre (évite de dupliquer event_type). */
export function entrepriseDetailItems(family: EntrepriseDisplayFamily): DisplayItem[] {
  if (!family.eventType) return family.items;
  return family.items.filter((item) => item.label !== family.eventType);
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

/** Normalise une date DPE (colonne ou display_signals) en YYYY-MM-DD. */
export function parseDpeDisplayDate(raw: string | null): string | null {
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const fr = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (fr) return `${fr[3]}-${fr[2]}-${fr[1]}`;
  return null;
}

/**
 * Âge du DPE recalculé à l'affichage (date du jour).
 * `age_jours` du pipeline est volontairement ignoré : il est figé au moment
 * de l'insertion et devient faux avec le temps.
 */
export function resolveDpeAgeJours(
  family: Pick<DpeDisplayFamily, 'date'>,
  dpeDate: string | null = null,
): number | null {
  const fromColumn = daysSinceDpe(dpeDate);
  if (fromColumn !== null) return fromColumn;
  const parsed = parseDpeDisplayDate(family.date);
  if (parsed) return daysSinceDpe(parsed);
  return null;
}

/** Libellé relatif recalculé à chaque affichage. */
export function formatDpeAgeLabel(ageJours: number | null): string | null {
  if (ageJours === null || ageJours < 0) return null;
  if (ageJours === 0) return "aujourd'hui";
  if (ageJours === 1) return 'hier';
  if (ageJours < 7) return `il y a ${ageJours} jours`;
  if (ageJours < 30) {
    const weeks = Math.floor(ageJours / 7);
    return weeks === 1 ? 'il y a 1 semaine' : `il y a ${weeks} semaines`;
  }
  return `il y a ${ageJours} jours`;
}
