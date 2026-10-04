'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * « Montre-moi cette adresse » : ce que la barre de recherche demande à la
 * carte. Si une carte est ouverte, elle reçoit la demande sur place ; sinon la
 * barre ouvre la carte avec la demande dans l'adresse de la page.
 */
export type CibleCarte = {
  latitude: number;
  longitude: number;
  libelle: string;
  /** Identifiant BAN : retrouve l'immeuble déjà suivi par l'agence. */
  banId: string | null;
  /** Change à chaque demande, même pour la même adresse cherchée deux fois. */
  cle: string;
};

const EVENEMENT = 'priimo:carte-cible';
let cartesOuvertes = 0;

/** Vrai si une carte écoute : la barre la déplace au lieu de changer de page. */
export function carteOuverte(): boolean {
  return cartesOuvertes > 0;
}

export function viserSurLaCarte(cible: Omit<CibleCarte, 'cle'>): void {
  window.dispatchEvent(
    new CustomEvent<CibleCarte>(EVENEMENT, { detail: { ...cible, cle: `${Date.now()}` } }),
  );
}

/** La page carte, déjà centrée sur l'adresse. */
export function hrefCarte(cible: Omit<CibleCarte, 'cle'>): string {
  const params = new URLSearchParams({
    vue: 'carte',
    aller: `${cible.latitude.toFixed(6)},${cible.longitude.toFixed(6)}`,
    libelle: cible.libelle,
  });
  if (cible.banId) params.set('ban', cible.banId);
  return `/dashboard/prospection?${params.toString()}`;
}

export function lireCibleUrl(params: { get: (k: string) => string | null }): CibleCarte | null {
  const aller = params.get('aller');
  const m = aller?.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const latitude = Number(m[1]);
  const longitude = Number(m[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return {
    latitude,
    longitude,
    libelle: params.get('libelle')?.slice(0, 160) || 'Adresse cherchée',
    banId: params.get('ban'),
    cle: `url:${aller}`,
  };
}

/** Pour une carte : la dernière adresse demandée, par l'URL ou par la barre. */
export function useCibleCarte(): CibleCarte | null {
  const params = useSearchParams();
  const depuisUrl = useMemo(() => lireCibleUrl(params), [params]);
  const [demandee, setDemandee] = useState<CibleCarte | null>(null);

  useEffect(() => {
    cartesOuvertes += 1;
    const ecouter = (e: Event) => setDemandee((e as CustomEvent<CibleCarte>).detail);
    window.addEventListener(EVENEMENT, ecouter);
    return () => {
      cartesOuvertes -= 1;
      window.removeEventListener(EVENEMENT, ecouter);
    };
  }, []);

  return demandee ?? depuisUrl;
}
