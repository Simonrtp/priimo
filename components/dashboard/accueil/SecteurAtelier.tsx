'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Zone } from '@/lib/zones/types';
import type { SecteurLead } from '@/components/dashboard/zones/SecteursClient';
import Modal from '@/components/ui/Modal';
import { useDevice } from '@/components/dashboard/device/DeviceProvider';

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
  membres: { id: string; fullName: string; firstName?: string; lastName?: string; avatarUrl?: string | null }[];
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
  const mobile = useDevice() === 'mobile';
  const titre = estDirecteur ? 'Les secteurs de l’agence' : 'Mon secteur';

  if (mobile) {
    return open ? (
      <AtelierPleinEcran titre={titre} onClose={onClose}>
        <SecteursClient
          zones={data.zones}
          membres={data.membres}
          leads={data.leads}
          centre={data.centre}
          estDirecteur={estDirecteur}
          profileId={data.profileId}
          onValider={onClose}
        />
      </AtelierPleinEcran>
    ) : null;
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={titre}
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

/**
 * Sur téléphone, l'atelier prend tout l'écran : la carte a besoin de place
 * pour qu'on y trace au doigt, et une fenêtre qui défile sous une carte
 * captait le geste.
 */
function AtelierPleinEcran({
  titre,
  onClose,
  children,
}: {
  titre: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="animate-app-sheet fixed inset-0 z-[130] flex flex-col bg-bg-base"
      role="dialog"
      aria-modal="true"
      aria-label={titre}
      style={{ height: '100dvh' }}
    >
      <header
        className="flex flex-shrink-0 items-center justify-between px-4 pb-2"
        style={{ paddingTop: 'calc(8px + env(safe-area-inset-top, 0px))' }}
      >
        <span className="w-11" aria-hidden />
        <h2 className="font-semibold text-text-strong" style={{ fontSize: 16 }}>
          {titre}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="app-press flex size-11 items-center justify-center rounded-full text-text-muted"
        >
          <X size={20} strokeWidth={2} aria-hidden />
        </button>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>,
    document.body,
  );
}
