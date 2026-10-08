/**
 * Les tâches qui tombent aujourd'hui, ou sont déjà en retard.
 *
 * Une tâche, ici, c'est une promesse : « Rappeler Janine » dicté dans une
 * note, ou posé à la main. Sur l'accueil mobile, elles passent avant les
 * objectifs, numéro et fiche à portée de pouce. Celles d'un autre jour restent
 * dans la pile ordinaire : elles n'ont rien à faire en tête d'écran ce matin.
 */

import type { TodayPromesse } from '@/types/metier';
import { estEcartee } from '@/lib/today/cards';
import { dateKeyParis } from '@/lib/today/calendar';
import { telHref } from '@/lib/import/normalize';

export type TacheDuJour = {
  id: string;
  intitule: string;
  /** 0 : aujourd'hui. n > 0 : en retard de n jours. */
  retardJours: number;
  contact: {
    id: string;
    nom: string | null;
    /** Affiché tel quel : « 06 12 34 56 78 ». */
    telephone: string | null;
    /** Lien `tel:` prêt à l'emploi, absent sans numéro. */
    tel: string | null;
  } | null;
  /** La note d'où vient la tâche, pour la relire quand aucun contact n'est lié. */
  noteId: string | null;
};

/** Même clé que la carte de l'écran Aujourd'hui : un report vaut pour les deux. */
export function clePromesse(id: string): string {
  return `promesse:${id}`;
}

/** Écart en jours entre deux dates « AAAA-MM-JJ ». */
function joursEntre(debut: string, fin: string): number {
  const a = Date.parse(`${debut}T12:00:00.000Z`);
  const b = Date.parse(`${fin}T12:00:00.000Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

export function tachesDuJour(
  promesses: readonly TodayPromesse[],
  dismissals: ReadonlyMap<string, string | null>,
  now: Date,
): TacheDuJour[] {
  // Le jour se compte à Paris : à 0 h 30, « demain » est déjà aujourd'hui.
  const aujourdhui = dateKeyParis(now);
  return promesses
    .filter((p) => p.statut === 'a_faire')
    .filter((p) => p.echeance <= aujourdhui)
    .filter((p) => !estEcartee(clePromesse(p.id), dismissals, now))
    .map((p) => ({
      id: p.id,
      intitule: p.intitule,
      retardJours: Math.max(0, joursEntre(p.echeance, aujourdhui)),
      contact: p.contactId
        ? {
            id: p.contactId,
            nom: p.contactName,
            telephone: p.contactPhone,
            tel: p.contactPhone ? telHref(p.contactPhone) : null,
          }
        : null,
      noteId: p.noteId ?? null,
    }))
    .sort(
      (a, b) => b.retardJours - a.retardJours || a.intitule.localeCompare(b.intitule, 'fr'),
    );
}
