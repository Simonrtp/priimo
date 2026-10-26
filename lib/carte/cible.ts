'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
const OUBLI = 'priimo:carte-cible-oubli';

/**
 * Diamètre du point à l'écran. Il est calé sur le zoom : petit quand on
 * s'éloigne, celui du repère dessiné (14 px) à l'arrivée sur l'adresse.
 */
const DIAMETRE_CIBLE: readonly (readonly [zoom: number, px: number])[] = [
  [12, 6],
  [15, 9],
  [17.5, 14],
  [19, 24],
];

/** En dessous, le nom couvrirait le pâté de maisons : on ne garde que le point. */
export const ZOOM_NOM_CIBLE = 16.25;

export function diametreCiblePx(zoom: number): number {
  const [premier] = DIAMETRE_CIBLE;
  const dernier = DIAMETRE_CIBLE[DIAMETRE_CIBLE.length - 1];
  if (!Number.isFinite(zoom) || zoom <= premier[0]) return premier[1];
  if (zoom >= dernier[0]) return dernier[1];
  for (let i = 1; i < DIAMETRE_CIBLE.length; i++) {
    const [z0, s0] = DIAMETRE_CIBLE[i - 1];
    const [z1, s1] = DIAMETRE_CIBLE[i];
    if (zoom > z1) continue;
    const t = (zoom - z0) / (z1 - z0);
    return s0 + t * (s1 - s0);
  }
  return dernier[1];
}

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

/** Retire le repère posé par la recherche. La carte reste où elle est. */
export function oublierCible(): void {
  window.dispatchEvent(new CustomEvent(OUBLI));
}

/**
 * Cible affichée. Un oubli masque aussi celle venue de l'URL, jusqu'à une
 * nouvelle demande.
 */
export function cibleAffichee(
  demandee: CibleCarte | null,
  depuisUrl: CibleCarte | null,
  oubliee: boolean,
): CibleCarte | null {
  if (oubliee) return null;
  return demandee ?? depuisUrl;
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
  const [oubliee, setOubliee] = useState(false);
  const cleUrl = depuisUrl?.cle ?? null;
  const cleUrlPrecedente = useRef(cleUrl);

  useEffect(() => {
    if (cleUrlPrecedente.current === cleUrl) return;
    cleUrlPrecedente.current = cleUrl;
    setOubliee(false);
  }, [cleUrl]);

  useEffect(() => {
    cartesOuvertes += 1;
    const ecouter = (e: Event) => {
      setDemandee((e as CustomEvent<CibleCarte>).detail);
      setOubliee(false);
    };
    const oublier = () => {
      setDemandee(null);
      setOubliee(true);
    };
    window.addEventListener(EVENEMENT, ecouter);
    window.addEventListener(OUBLI, oublier);
    return () => {
      cartesOuvertes -= 1;
      window.removeEventListener(EVENEMENT, ecouter);
      window.removeEventListener(OUBLI, oublier);
    };
  }, []);

  return cibleAffichee(demandee, depuisUrl, oubliee);
}
