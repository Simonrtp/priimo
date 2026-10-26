/**
 * « Annuler cet import » : ce qu'on retire et ce qu'on remet comme avant.
 *
 * Une fiche créée par l'import est retirée seulement si personne n'y a touché
 * depuis (ni modification, ni note, ni visite…). Une fiche existante complétée
 * retrouve, champ par champ, sa valeur d'avant — sauf si ce champ a été
 * modifié entre-temps : le travail de l'agent passe avant l'annulation.
 */

import type { ContactInputFields } from '@/lib/contact-input';
import type { ContactImportCompletion } from '@/types/database';

export const ANNULATION_JOURS = 7;
const ANNULATION_MS = ANNULATION_JOURS * 86_400_000;

/** Les écritures d'un même import arrivent par lots : quelques secondes de marge. */
export const MARGE_FIN_IMPORT_MS = 5_000;

export function importAnnulable(
  row: { created_at: string; annule_le: string | null },
  now = Date.now(),
): boolean {
  return !row.annule_le && now - Date.parse(row.created_at) <= ANNULATION_MS;
}

export function tableImportsAbsente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message ?? '';
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  return (
    /contact_imports|import_id/.test(message) &&
    (error.code === 'PGRST204' || error.code === '42703' || /does not exist|could not find/i.test(message))
  );
}

const COLONNES_DU_CHAMP: Record<keyof ContactInputFields, readonly string[]> = {
  firstName: ['first_name'],
  lastName: ['last_name'],
  type: ['contact_type', 'autres_types'],
  autresTypes: ['contact_type', 'autres_types'],
  phone: ['phone'],
  numeroCommuniqueParLaPersonne: ['numero_communique_par_la_personne'],
  email: ['email'],
  secteur: ['secteur'],
  address: ['address'],
  postalCodes: ['postal_codes'],
  budgetMin: ['budget_min'],
  budgetMax: ['budget_max'],
  surfaceMin: ['surface_min'],
  surfaceMax: ['surface_max'],
  roomsMin: ['rooms_min'],
  summary: ['summary'],
  recontacterLe: ['recontacter_le'],
};

export const COLONNES_GEO = [
  'ban_id',
  'latitude',
  'longitude',
  'adresse_normalisee',
  'geocode_score',
  'geocode_le',
] as const;

/** Colonnes de `contacts` touchées par des champs complétés. */
export function colonnesDesChamps(champs: readonly (keyof ContactInputFields)[]): string[] {
  return [...new Set(champs.flatMap((champ) => COLONNES_DU_CHAMP[champ]))];
}

function memeValeur(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Ce qu'il faut réécrire pour défaire une complétion, d'après la fiche telle
 * qu'elle est aujourd'hui. `null` : plus rien à défaire.
 */
export function retablissement(
  actuel: Record<string, unknown>,
  completion: ContactImportCompletion,
): Record<string, unknown> | null {
  const geo: readonly string[] = COLONNES_GEO;
  const patch: Record<string, unknown> = {};
  for (const [colonne, valeur] of Object.entries(completion.apres)) {
    if (geo.includes(colonne)) continue;
    if (memeValeur(actuel[colonne], valeur)) patch[colonne] = completion.avant[colonne] ?? null;
  }
  // Le point sur la carte suit l'adresse : on le remet si personne ne l'a déplacé.
  if ('ban_id' in completion.apres && memeValeur(actuel.ban_id, completion.apres.ban_id)) {
    for (const colonne of geo) {
      if (colonne in completion.apres) patch[colonne] = completion.avant[colonne] ?? null;
    }
  }
  return Object.keys(patch).length ? patch : null;
}

/** Fiches créées par l'import qu'on peut retirer : pas modifiées depuis la fin de l'import. */
export function intactesDepuisImport(
  fiches: readonly { id: string; updated_at: string }[],
  termineLe: string,
): string[] {
  const limite = Date.parse(termineLe) + MARGE_FIN_IMPORT_MS;
  return fiches.filter((f) => Date.parse(f.updated_at) <= limite).map((f) => f.id);
}
