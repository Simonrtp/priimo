'use client';

import dynamic from 'next/dynamic';
import type { Zone } from '@/lib/zones/types';
import type { SecteurLead } from '@/components/dashboard/zones/SecteursClient';

/**
 * Coquille de l'onglet « Secteurs ». La carte et l'outil de dessin pèsent
 * lourd : ils ne se chargent que si l'onglet s'ouvre.
 */
const SecteursClient = dynamic(() => import('@/components/dashboard/zones/SecteursClient'), {
  ssr: false,
  loading: () => (
    <div className="h-[560px] animate-pulse rounded-clay-lg bg-black/[0.04]" aria-hidden />
  ),
});

export type SecteursData = {
  zones: Zone[];
  membres: { id: string; fullName: string }[];
  leads: SecteurLead[];
  centre: { latitude: number | null; longitude: number | null };
  profileId: string;
};

export default function SectionSecteurs({
  data,
  estDirecteur,
}: {
  data: SecteursData;
  estDirecteur: boolean;
}) {
  return (
    <SecteursClient
      zones={data.zones}
      membres={data.membres}
      leads={data.leads}
      centre={data.centre}
      estDirecteur={estDirecteur}
      profileId={data.profileId}
    />
  );
}
