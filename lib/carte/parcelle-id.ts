/**
 * Identifiant cadastral canonique : 14 caractères, majuscules, sans séparateur.
 * Commune INSEE (5) + préfixe (3) + section (2) + numéro (4).
 * Exemple : 75111000AI0004.
 *
 * Toute écriture et toute lecture passe par normalizeParcelleId.
 * Les tuiles IGN exposent encore la propriété `idu` : la normaliser dès la lecture.
 */

export const PARCELLE_ID_LENGTH = 14;

const PARCELLE_ID_RE = /^[0-9A-Z]{14}$/;

export function normalizeParcelleId(raw: string | null | undefined): string | null {
  const compact = (raw ?? '').replace(/[\s-]/g, '').toUpperCase();
  if (!PARCELLE_ID_RE.test(compact)) {
    if ((raw ?? '').trim()) {
      console.warn('[parcelle_id] rejeté', { raw, compact, length: compact.length });
    }
    return null;
  }
  return compact;
}

export function formatParcelleId(parcelleId: string): string {
  const v = parcelleId.trim().toUpperCase();
  if (v.length === PARCELLE_ID_LENGTH) {
    return `${v.slice(0, 5)} ${v.slice(5, 8)} ${v.slice(8, 10)} ${v.slice(10)}`;
  }
  return v;
}
