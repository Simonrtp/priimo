import { dateCourte } from '@/lib/annonces/presenter';
import { nomProprietaireAffiche } from '@/lib/lead-apercu';
import type { Lead } from '@/types/lead';
import { resumeBien } from './bien';
import { daysSinceTaken } from './stale';

function sansAccent(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Adresse, ville, propriétaire, résumé du bien : de quoi retrouver une carte. */
export function leadPipelineCorrespond(lead: Lead, cherche: string): boolean {
  if (!cherche) return true;
  const texte = [
    lead.address,
    lead.city,
    lead.postalCode,
    nomProprietaireAffiche(lead),
    resumeBien(lead),
    lead.bien?.propertyType,
    lead.notes,
  ]
    .filter(Boolean)
    .join(' ');
  return sansAccent(texte).includes(cherche);
}

/** Bien saisi / collé / estimé : une fiche bien est rattachée. */
export function estBienRentre(lead: Lead): boolean {
  return lead.bien != null;
}

/**
 * Quand le négociateur a rentré le bien dans le pipeline (`taken_at`).
 * Absent si la carte n'a pas encore d'entrée datée.
 */
export function libelleRentree(takenAt: string | null | undefined, now = new Date()): string | null {
  if (!takenAt) return null;
  const days = daysSinceTaken(takenAt, now);
  if (days === null) return null;
  if (days === 0) return 'Rentré aujourd’hui';
  if (days === 1) return 'Rentré hier';
  if (days < 7) return `Rentré il y a ${days} j`;
  const courte = dateCourte(takenAt);
  return courte ? `Rentré le ${courte}` : null;
}
