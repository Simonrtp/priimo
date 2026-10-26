/**
 * Relecture des colonnes par Mon assistant, partie pure (navigateur et serveur).
 *
 * Mon assistant ne voit que les en-têtes et trois exemples masqués par
 * colonne : les chiffres au-delà des deux premiers deviennent des zéros
 * (06 12 34 56 78 → 06 00 00 00 00, 75002 → 75000), le début d'un email est
 * caché. Assez pour reconnaître un téléphone ou un code postal, pas pour
 * appeler quelqu'un.
 *
 * Il répond par numéros de colonne, pas par noms : la même réponse vaut pour
 * un fichier sans ligne d'en-tête, et un format retenu ne garde aucun texte
 * du fichier.
 */

import { CONTACT_IMPORT_FIELDS, contactMappingSuffisant } from './contacts';
import { IGNORE_COLUMN } from './mapping';
import type { ParsedTable } from './parse-file';

export const EXEMPLES_PAR_COLONNE = 3;
export const LIGNES_SONDEES = 50;
export const MAX_COLONNES_RELUES = 80;
const MAX_EXEMPLE = 60;

const CHAMPS = new Set(CONTACT_IMPORT_FIELDS.map((f) => f.key));

export type ColonnesIndex = {
  /** Champ Priimo → numéro de colonne (à partir de 0). */
  champs: Record<string, number>;
  /** Colonnes à garder dans le résumé, « En-tête : valeur ». */
  notes: number[];
  /** La première ligne du fichier est un contact, pas des titres. */
  premiereLigneDonnee: boolean;
};

export function masquerExemple(valeur: string): string {
  let chiffresVus = 0;
  return valeur
    .slice(0, MAX_EXEMPLE)
    .replace(/[^\s@<>,;:]+@/g, (local) => `${local[0] ?? ''}•••@`)
    .replace(/\d/g, (c) => (++chiffresVus <= 2 ? c : '0'));
}

/** Trois valeurs distinctes et masquées par colonne, prises dans les premières lignes. */
export function exemplesColonnes(table: ParsedTable): string[][] {
  return table.headers.slice(0, MAX_COLONNES_RELUES).map((header) => {
    const vus: string[] = [];
    for (const row of table.rows.slice(0, LIGNES_SONDEES)) {
      const v = row.values[header]?.trim();
      if (v && !vus.includes(v)) vus.push(v);
      if (vus.length >= EXEMPLES_PAR_COLONNE) break;
    }
    return vus.map(masquerExemple);
  });
}

/**
 * Un tableur dont des colonnes pleines restent sans correspondance, ou sans
 * nom / téléphone / email reconnu : Mon assistant y jette un œil. Une vCard,
 * Google ou le téléphone ont des colonnes fixes, toujours reconnues.
 */
export function aRelire(table: ParsedTable, mapping: Record<string, string>): boolean {
  if (table.format && table.format !== 'tableur') return false;
  if (!contactMappingSuffisant(mapping)) return true;
  const reliees = new Set(Object.values(mapping).filter(Boolean));
  return table.headers.some(
    (header) =>
      !reliees.has(header) && table.rows.slice(0, LIGNES_SONDEES).some((row) => row.values[header]?.trim()),
  );
}

/**
 * Filet sous Mon assistant : un « titre » qui contient un email ou un numéro
 * de téléphone est forcément la première ligne de données.
 */
export function enTetesSontDesDonnees(headers: readonly string[]): boolean {
  return headers.some((h) => /\S+@\S+\.\S+/.test(h) || (h.match(/\d/g) ?? []).length >= 8);
}

function indexValide(v: unknown, nbColonnes: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < nbColonnes;
}

/**
 * Ne garde de la réponse que des champs connus, des colonnes existantes,
 * chacune une fois. Un nom complet relié l'emporte sur un prénom ou un nom
 * tirés de la même idée : jamais les deux à la fois.
 */
export function validerColonnes(brut: unknown, nbColonnes: number): ColonnesIndex | null {
  if (typeof brut !== 'object' || brut === null) return null;
  const r = brut as Record<string, unknown>;
  const champsBruts =
    typeof r.champs === 'object' && r.champs !== null ? (r.champs as Record<string, unknown>) : {};
  const prises = new Set<number>();
  const champs: Record<string, number> = {};
  for (const field of CONTACT_IMPORT_FIELDS) {
    const v = champsBruts[field.key];
    if (!CHAMPS.has(field.key) || !indexValide(v, nbColonnes) || prises.has(v)) continue;
    champs[field.key] = v;
    prises.add(v);
  }
  if (champs.fullName !== undefined && (champs.firstName !== undefined || champs.lastName !== undefined)) {
    // Prénom et nom dans deux colonnes : plus précis. Sinon le nom complet, que l'import sait découper.
    if (champs.firstName !== undefined && champs.lastName !== undefined) delete champs.fullName;
    else {
      delete champs.firstName;
      delete champs.lastName;
    }
  }
  const notes = (Array.isArray(r.notes) ? r.notes : []).filter(
    (v): v is number => indexValide(v, nbColonnes) && !prises.has(v),
  );
  return {
    champs,
    notes: [...new Set(notes)],
    premiereLigneDonnee: r.premiere_ligne_est_une_donnee === true || r.premiereLigneDonnee === true,
  };
}

/** Le fichier n'avait pas de titres : la ligne lue comme en-tête redevient le premier contact. */
export function sansLigneEnTete(table: ParsedTable): ParsedTable {
  const headers = table.headers.map((_, i) => `Colonne ${i + 1}`);
  const enLigne = (values: Record<string, string>) =>
    Object.fromEntries(headers.map((h, i) => [h, values[table.headers[i] ?? ''] ?? '']));
  const premiere = Object.fromEntries(
    headers.map((h, i) => [h, /^Colonne \d+$/.test(table.headers[i] ?? '') ? '' : (table.headers[i] ?? '')]),
  );
  return {
    ...table,
    headers,
    rows: [
      { line: 1, values: premiere },
      ...table.rows.map((row) => ({ line: row.line, values: enLigne(row.values) })),
    ],
  };
}

/**
 * Correspondance finale : ce que les en-têtes disent clairement (alias) reste ;
 * Mon assistant remplit le reste. Sans ligne d'en-tête, les alias n'ont rien
 * lu de fiable : sa réponse fait foi.
 */
export function fusionnerCorrespondance(
  headers: readonly string[],
  aliases: Record<string, string>,
  ia: ColonnesIndex,
): Record<string, string> {
  const base: Record<string, string> = {};
  for (const field of CONTACT_IMPORT_FIELDS) {
    base[field.key] = ia.premiereLigneDonnee ? IGNORE_COLUMN : (aliases[field.key] ?? IGNORE_COLUMN);
  }
  const prises = new Set(Object.values(base).filter(Boolean));
  for (const [champ, index] of Object.entries(ia.champs)) {
    const header = headers[index];
    if (!header || base[champ] || prises.has(header)) continue;
    base[champ] = header;
    prises.add(header);
  }
  return base;
}

export function notesEnTetes(headers: readonly string[], ia: ColonnesIndex, mapping: Record<string, string>): string[] {
  const reliees = new Set(Object.values(mapping).filter(Boolean));
  return ia.notes.map((i) => headers[i]).filter((h): h is string => Boolean(h) && !reliees.has(h as string));
}

/** Pour retenir un format : la correspondance en numéros de colonne. */
export function versIndex(
  headers: readonly string[],
  mapping: Record<string, string>,
  notes: readonly string[],
): { champs: Record<string, number>; notes: number[] } {
  const champs: Record<string, number> = {};
  for (const [champ, header] of Object.entries(mapping)) {
    const i = header ? headers.indexOf(header) : -1;
    if (i >= 0) champs[champ] = i;
  }
  return { champs, notes: notes.map((h) => headers.indexOf(h)).filter((i) => i >= 0) };
}
