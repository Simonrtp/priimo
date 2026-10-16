'use client';

import AnnoncesBureau, { type FiltresAnnonces } from '@/components/dashboard/annonces/AnnoncesBureau';
import type { Annonce, RunAnnonce } from '@/lib/annonces/types';
import type { Zone } from '@/lib/zones/types';

/** Liste de terrain : pas la carte bureau, les fiches s'ouvrent en dessous. */
export default function AnnoncesMobile(props: {
  annonces: Annonce[];
  runs: RunAnnonce[];
  zones: Zone[];
  directeur: boolean;
  profileId: string;
  initial: FiltresAnnonces;
}) {
  return <AnnoncesBureau {...props} mobile />;
}
