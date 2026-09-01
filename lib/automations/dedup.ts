/**
 * Clés de déduplication.
 *
 * Une clé répond à une seule question : « est-ce que je l'ai déjà proposé ? ».
 * Elle doit donc être stable pour un même signal, et changer quand le signal
 * mérite d'être reproposé.
 *
 * Deux familles :
 *   — ponctuelle : `dedupKey('veille_dpe', numeroDpe)` → proposée une fois, jamais deux.
 *   — récurrente : `dedupKey('compte_rendu_mandat', bienId, moisDe(now))` → revient
 *     chaque mois, sans jamais doubler à l'intérieur du mois.
 */

import type { AutomationKind } from './types';

export function dedupKey(kind: AutomationKind, ...parts: readonly (string | number)[]): string {
  const tail = parts
    .map((p) => String(p).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-'))
    .filter(Boolean)
    .join(':');
  return tail ? `${kind}:${tail}` : kind;
}

/** `2026-08` — période des propositions mensuelles. */
export function moisDe(date: Date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** `2026-W35` — période des propositions hebdomadaires (semaine ISO). */
export function semaineDe(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Jeudi de la semaine courante : définit l'année ISO.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const debutAnnee = Date.UTC(d.getUTCFullYear(), 0, 1);
  const semaine = Math.ceil(((d.getTime() - debutAnnee) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(semaine).padStart(2, '0')}`;
}

/** `2026-T3` — période des propositions trimestrielles. */
export function trimestreDe(date: Date = new Date()): string {
  return `${date.getUTCFullYear()}-T${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

/** `2026-08-31` — période des propositions quotidiennes. */
export function jourDe(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
