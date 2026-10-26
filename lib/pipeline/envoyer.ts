'use client';

import { notifyError, notifyInfo, notifySuccess } from '@/lib/notify';
import { lancerBilleVersPipeline } from '@/lib/ui/vol-pipeline';
import type { Lead } from '@/types/lead';

export type DemandePipeline = {
  address: string;
  city?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  banId?: string | null;
  surfaceM2?: number | null;
  rooms?: number | null;
  etage?: string | null;
  dpeClass?: string | null;
  propertyType?: string | null;
  ownerType?: 'particulier' | 'entreprise';
  companyName?: string | null;
  notes?: string | null;
  provenance?: 'terrain' | 'portail';
  price?: number | null;
  photos?: string[];
  /** Lien de l'annonce : gardé sur la fiche bien, pas sur la carte. */
  lien?: string | null;
};

export type ResultatPipeline = { lead: Lead; etat: 'cree' | 'pris' | 'deja' };

/** Pose le bien dans Pris. La bille part vers l'onglet quand on n'y est pas déjà. */
export async function envoyerAuPipeline(
  demande: DemandePipeline,
  origine?: HTMLElement | null,
): Promise<ResultatPipeline | null> {
  try {
    const res = await fetch('/api/dashboard/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(demande),
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      etat?: 'cree' | 'pris' | 'deja';
      lead?: Lead;
    };
    if (!res.ok || !body.lead || !body.etat) {
      notifyError(body.error ?? 'Impossible d’ajouter au pipeline.');
      return null;
    }
    if (body.etat === 'deja') notifyInfo('Déjà au pipeline');
    else {
      notifySuccess('Bien ajouté dans Pris');
      if (origine) lancerBilleVersPipeline(origine);
    }
    return { lead: body.lead, etat: body.etat };
  } catch {
    notifyError('Impossible d’ajouter au pipeline.');
    return null;
  }
}
