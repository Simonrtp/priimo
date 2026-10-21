import { euros, libellePortail } from '@/lib/annonces/presenter';

export type LeadDejaLa = {
  stageId: string | null;
  score: number;
};

/** Un lead déjà à cette adresse : on le prend s'il n'est pas au pipeline, sinon on le dit. */
export function deciderEntree<T extends LeadDejaLa>(
  existants: readonly T[],
): { action: 'creer' } | { action: 'prendre' | 'deja'; lead: T } {
  if (existants.length === 0) return { action: 'creer' };
  const libres = existants
    .filter((lead) => lead.stageId == null)
    .sort((a, b) => b.score - a.score);
  const libre = libres[0];
  if (libre) return { action: 'prendre', lead: libre };
  const pris = [...existants].sort((a, b) => b.score - a.score)[0];
  return pris ? { action: 'deja', lead: pris } : { action: 'creer' };
}

/** Ligne courte gardée sur le lead : d'où vient l'annonce. */
export function noteDepuisAnnonce(portail: string, prix: number | null): string {
  const nom = libellePortail(portail);
  if (prix == null) return `Annonce ${nom}`;
  return `Annonce ${nom} · ${euros(prix)}`;
}
