/**
 * Une phase, un comportement. La pause rend la carte normale
 * (recherche, pastilles, onglets) sans jeter le tracé.
 */
export type PhaseTournee = 'off' | 'preparation' | 'brief' | 'route' | 'pause' | 'bilan';

export type DrapeauxPhase = {
  /** Le tracé de cette tournée reste dessiné. */
  trace: boolean;
  /** Carte atténuée : ni pastilles d'immeubles, ni cadastre. */
  immersion: boolean;
  /** Recherche, filtres et onglets. */
  chrome: boolean;
  /** Le GPS compte la marche. */
  suivi: boolean;
  /** La barre d'onglets se cache. */
  occupe: boolean;
};

export function drapeauxPhase(phase: PhaseTournee): DrapeauxPhase {
  switch (phase) {
    case 'off':
      return { trace: false, immersion: false, chrome: true, suivi: false, occupe: false };
    case 'preparation':
      return { trace: false, immersion: false, chrome: false, suivi: false, occupe: true };
    case 'brief':
      return { trace: true, immersion: true, chrome: false, suivi: true, occupe: true };
    case 'route':
      return { trace: true, immersion: true, chrome: false, suivi: true, occupe: true };
    case 'pause':
      return { trace: true, immersion: false, chrome: true, suivi: false, occupe: false };
    case 'bilan':
      return { trace: true, immersion: true, chrome: false, suivi: false, occupe: true };
    default: {
      const inconnue: never = phase;
      void inconnue;
      return { trace: false, immersion: false, chrome: true, suivi: false, occupe: false };
    }
  }
}
