import type { Lead } from '@/types/lead';

/**
 * Lead ouvert pendant la visite guidée (marché / signaux / contacts / résultat).
 * Priorité : hors_marché + owner + numéros immeuble → hors_marché + owner
 * → hors_marché → contacts immeuble → premier lead.
 */
export function pickTourLeadId(leads: Lead[]): string | null {
  if (leads.length === 0) return null;

  const hasImmeublePhones = (l: Lead) => l.contactsImmeuble.length > 0;

  const horsMarcheOwnerPhones = leads.find(
    (l) =>
      l.marcheStatut === 'hors_marche' &&
      Boolean(l.ownerName?.trim()) &&
      hasImmeublePhones(l),
  );
  if (horsMarcheOwnerPhones) return horsMarcheOwnerPhones.id;

  const horsMarcheWithOwner = leads.find(
    (l) => l.marcheStatut === 'hors_marche' && Boolean(l.ownerName?.trim()),
  );
  if (horsMarcheWithOwner) return horsMarcheWithOwner.id;

  const horsMarche = leads.find((l) => l.marcheStatut === 'hors_marche');
  if (horsMarche) return horsMarche.id;

  const withImmeublePhones = leads.find(hasImmeublePhones);
  if (withImmeublePhones) return withImmeublePhones.id;

  return leads[0]?.id ?? null;
}
