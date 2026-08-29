/**
 * Critères complémentaires du parcours agent.
 *
 * Ils étaient jusqu'ici collectés et rangés dans le contexte sans jamais peser
 * sur la valeur : un critère qu'on demande et qu'on ignore décore le
 * formulaire, il ne l'améliore pas. Chacun produit désormais un coefficient et
 * une ligne dans le détail du calcul, marquée « ajustement forfaitaire » —
 * aucun de ces pourcentages n'est calibré sur un échantillon de ventes.
 */

import { CONFIG_ESTIMATION } from '@/lib/estimation';

export type EstimationExtras = {
  /** Appartement. */
  duplex?: boolean;
  balconM2?: number | null;
  chargesMensuelles?: number | null;
  /** Maison. */
  terrainM2?: number | null;
  niveaux?: number | null;
  sousSol?: boolean;
  sousSolM2?: number | null;
  sousSolAmenage?: boolean;
  garagePlaces?: number | null;
  dependances?: boolean;
};

export type ExtraCoeff = {
  id: string;
  label: string;
  pct: number;
};

const E = CONFIG_ESTIMATION.EXTRAS;

function positive(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Coefficients issus des critères complémentaires, dans l'ordre d'affichage.
 * Les critères hors périmètre du type de bien sont ignorés : un terrain sur
 * un appartement ne veut rien dire.
 */
export function extrasCoefficients(
  propertyType: 'appartement' | 'maison',
  extras: EstimationExtras | null | undefined,
): ExtraCoeff[] {
  if (!extras) return [];
  const out: ExtraCoeff[] = [];

  if (propertyType === 'appartement') {
    if (extras.duplex) {
      out.push({ id: 'duplex', label: 'Duplex', pct: E.DUPLEX_PCT });
    }
    const balcon = positive(extras.balconM2);
    if (balcon != null && balcon >= E.GRANDE_TERRASSE_M2) {
      out.push({
        id: 'grande_terrasse',
        label: `Terrasse de ${Math.round(balcon)} m²`,
        pct: E.GRANDE_TERRASSE_PCT,
      });
    }
    // Les charges sont conservées comme information de contexte : sans
    // référence locale de charges au m², en tirer un coefficient serait
    // inventer un chiffre.
    return out;
  }

  const terrain = positive(extras.terrainM2);
  if (terrain != null) {
    const pct = Math.min(
      E.TERRAIN_CAP_PCT,
      (terrain / 100) * E.TERRAIN_PCT_PAR_100M2,
    );
    if (pct > 0) {
      out.push({
        id: 'terrain',
        label: `Terrain de ${Math.round(terrain).toLocaleString('fr-FR')} m²`,
        pct,
      });
    }
  }

  if (extras.sousSol) {
    const surface = positive(extras.sousSolM2);
    const suffixe = surface != null ? ` de ${Math.round(surface)} m²` : '';
    out.push(
      extras.sousSolAmenage
        ? { id: 'sous_sol', label: `Sous-sol aménagé${suffixe}`, pct: E.SOUS_SOL_AMENAGE_PCT }
        : { id: 'sous_sol', label: `Sous-sol${suffixe}`, pct: E.SOUS_SOL_BRUT_PCT },
    );
  }

  const places = positive(extras.garagePlaces);
  if (places != null) {
    const pct = Math.min(
      E.GARAGE_CAP_PCT,
      E.GARAGE_PREMIERE_PCT + (places - 1) * E.GARAGE_PLACE_SUP_PCT,
    );
    out.push({
      id: 'garage',
      label: places > 1 ? `Garage ${Math.round(places)} places` : 'Garage',
      pct,
    });
  }

  if (extras.dependances) {
    out.push({ id: 'dependances', label: 'Dépendances', pct: E.DEPENDANCES_PCT });
  }

  // Le nombre de niveaux est enregistré mais ne porte aucun coefficient :
  // plain-pied ou étages, l'effet dépend trop du marché local pour être
  // forfaitisé honnêtement.
  return out;
}

export function extrasTotalPct(coeffs: readonly ExtraCoeff[]): number {
  return coeffs.reduce((sum, c) => sum + c.pct, 0);
}

/** Nettoie ce qui arrive du client avant de le confier au moteur. */
export function parseExtras(raw: unknown): EstimationExtras | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const num = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return {
    duplex: b.duplex === true,
    balconM2: num(b.balconM2),
    chargesMensuelles: num(b.chargesMensuelles),
    terrainM2: num(b.terrainM2),
    niveaux: num(b.niveaux),
    sousSol: b.sousSol === true,
    sousSolM2: num(b.sousSolM2),
    sousSolAmenage: b.sousSolAmenage === true,
    garagePlaces: num(b.garagePlaces),
    dependances: b.dependances === true,
  };
}
