'use client';

import dynamic from 'next/dynamic';
import type { Zone } from '@/lib/zones/types';
import type { SecteurLead } from '@/components/dashboard/zones/SecteursClient';
import Modal from '@/components/ui/Modal';

/**
 * L'atelier de découpage vit sur l'Accueil, pas dans les paramètres : dessiner
 * son secteur est le premier geste de travail d'un négociateur, pas un réglage
 * qu'on va chercher dans un sous-onglet.
 *
 * Le modal ne s'ouvre pas lui-même. C'est SecteurAccueil qui tient l'état,
 * sinon un rafraîchissement qui fait basculer « dessiner » en « mon secteur »
 * démonterait l'atelier en plein travail.
 */
const SecteursClient = dynamic(() => import('@/components/dashboard/zones/SecteursClient'), {
  ssr: false,
  loading: () => (
    <div className="h-[520px] animate-pulse rounded-clay-lg bg-black/[0.04]" aria-hidden />
  ),
});

export type SecteursData = {
  zones: Zone[];
  membres: { id: string; fullName: string }[];
  leads: SecteurLead[];
  centre: { latitude: number | null; longitude: number | null };
  profileId: string;
};

export default function AtelierSecteur({
  open,
  onClose,
  data,
  estDirecteur,
}: {
  open: boolean;
  onClose: () => void;
  data: SecteursData;
  estDirecteur: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={estDirecteur ? 'Les secteurs de l’agence' : 'Mon secteur'}
      description={
        estDirecteur
          ? 'Le découpage entre négociateurs. Chacun dessine le sien, vous arbitrez.'
          : 'Tracez le contour, ajoutez ou retirez des rues. Deux minutes, une fois pour toutes.'
      }
      maxWidth="3xl"
    >
      <SecteursClient
        zones={data.zones}
        membres={data.membres}
        leads={data.leads}
        centre={data.centre}
        estDirecteur={estDirecteur}
        profileId={data.profileId}
        onValider={onClose}
      />
    </Modal>
  );
}
