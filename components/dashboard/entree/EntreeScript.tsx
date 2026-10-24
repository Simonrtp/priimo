'use client';

import { useSyncExternalStore } from 'react';
import { SCRIPT_ENTREE } from '@/lib/entree/entree';

const abonnerRien = () => () => undefined;

/**
 * Premier enfant de la coque : à l'ouverture de la page, il lui pose le
 * marqueur d'entrée avant tout rendu. Rendu seulement par le serveur (et
 * repris tel quel à l'hydratation) : en navigation dans l'application, un
 * script inséré par React ne s'exécuterait pas, c'est EntreeDashboard qui décide.
 */
export default function EntreeScript() {
  const rendServeur = useSyncExternalStore(abonnerRien, () => false, () => true);
  if (!rendServeur) return null;
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT_ENTREE }} />;
}
