'use client';

import type { ExpressionSpecification } from 'mapbox-gl';
import { DPE_PALETTE } from '@/lib/carte/dpe-public';

/**
 * Les passoires (F, G) se voient de loin :
 *   - en vue de quartier (z11 → z15), une chaleur orange-rouge là où elles se
 *     concentrent, qui s'efface à mesure que les pastilles prennent le relais ;
 *   - de près, un halo doux autour de chaque F et G.
 */
export const PASSOIRES_CHALEUR_LAYER_ID = 'cadastre-dpe-chaleur';
export const PASSOIRES_LUEUR_LAYER_ID = 'cadastre-dpe-lueur';

const PASSOIRE: ExpressionSpecification = ['all', ['==', ['get', 'hasDpe'], '1'], ['in', ['get', 'letter'], ['literal', ['F', 'G']]]];

export const CHALEUR_FILTER = PASSOIRE;
export const CHALEUR_MAXZOOM = 15.5;
export const CHALEUR_PAINT = {
  'heatmap-weight': ['match', ['get', 'letter'], 'G', 1, 0.65] as ExpressionSpecification,
  'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 15, 1.4] as ExpressionSpecification,
  'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 11, 10, 13, 22, 15, 38] as ExpressionSpecification,
  'heatmap-color': [
    'interpolate',
    ['linear'],
    ['heatmap-density'],
    0,
    'rgba(235,125,59,0)',
    0.2,
    'rgba(247,181,63,0.28)',
    0.45,
    'rgba(235,125,59,0.45)',
    0.75,
    'rgba(217,34,49,0.58)',
    1,
    'rgba(170,20,36,0.7)',
  ] as ExpressionSpecification,
  'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.9, 14, 0.6, CHALEUR_MAXZOOM, 0] as ExpressionSpecification,
};

export const LUEUR_FILTER = PASSOIRE;
export const LUEUR_MINZOOM = 14;
const COULEUR_LUEUR: ExpressionSpecification = ['match', ['get', 'letter'], 'G', DPE_PALETTE.G, DPE_PALETTE.F];

/**
 * Un halo fixe : une animation redessinerait la carte en continu, l'empêchant
 * de se poser (`idle`), ce dont dépendent l'ordre des couches et l'immeuble
 * allumé — et viderait la batterie du téléphone de terrain.
 */
export const LUEUR_PAINT = {
  'circle-color': COULEUR_LUEUR,
  'circle-blur': 0.6,
  'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 14, 18, 24] as ExpressionSpecification,
  'circle-opacity': 0.5,
  'circle-pitch-alignment': 'viewport' as const,
  'circle-pitch-scale': 'viewport' as const,
};
