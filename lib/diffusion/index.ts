import { ExportDiffusionProvider } from './providers/export';
import type { DiffusionProvider } from './types';

export type DiffusionProviderId = 'export';

const PROVIDERS: Record<DiffusionProviderId, () => DiffusionProvider> = {
  export: () => new ExportDiffusionProvider('xml'),
};

/**
 * Point d'entrée export local. Pour la multidiffusion portail, utiliser
 * `getDiffusionTransport` + `publierAnnonce` (passerelle Ubiflow / Diffuze).
 */
export function getDiffusionProvider(id: DiffusionProviderId = 'export'): DiffusionProvider {
  return PROVIDERS[id]();
}

export { ExportDiffusionProvider } from './providers/export';
export {
  assessAnnonce,
  assessAnnonceForPortail,
  assessObligationsFrancaises,
  canPublish,
  mentionsLegales,
  PORTAIL_RULES,
} from './completeness';
export { bienToAnnonce } from './from-bien';
export { publierAnnonce, cleIdempotence } from './publish';
export { getDiffusionTransport } from './transport/gateway';
export type { Annonce, DiffusionProvider, DiffusionResult, DiffusionTransport, PortailId } from './types';
export { PORTAIL_LABELS } from './types';
