import { ExportDiffusionProvider } from './providers/export';
import type { DiffusionProvider } from './types';

export type DiffusionProviderId = 'export';

const PROVIDERS: Record<DiffusionProviderId, () => DiffusionProvider> = {
  export: () => new ExportDiffusionProvider('xml'),
};

/**
 * Point d'entrée unique. Le jour où une passerelle réelle existe, on ajoute
 * son identifiant ici — aucune page, aucun formulaire n'a besoin de changer.
 */
export function getDiffusionProvider(id: DiffusionProviderId = 'export'): DiffusionProvider {
  return PROVIDERS[id]();
}

export { ExportDiffusionProvider } from './providers/export';
export { assessAnnonce, mentionsLegales } from './completeness';
export { bienToAnnonce } from './from-bien';
export type { Annonce, DiffusionProvider, DiffusionResult } from './types';
