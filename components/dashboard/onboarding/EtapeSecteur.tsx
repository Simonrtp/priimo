'use client';

import OnboardingShell from './OnboardingShell';
import OnboardingCarte from './OnboardingCarte';
import type { BuildingMarker } from '@/lib/carte/buildings';
import type { OnboardingSecteur } from '@/lib/queries/agent-onboarding';

/**
 * Étape 0 — le secteur est déjà là.
 *
 * Pas une question, une démonstration : la carte de son agence, ses adresses,
 * ses immeubles. C'est le moment qui décide de tout, aucun autre logiciel ne
 * démarre plein. Une phrase, des chiffres réels, et rien d'autre.
 */
export default function EtapeSecteur({
  rang,
  total,
  secteur,
  buildings,
  center,
  onSuivant,
  onPasser,
}: {
  rang: number;
  total: number;
  secteur: OnboardingSecteur;
  buildings: readonly BuildingMarker[];
  center: { latitude: number | null; longitude: number | null };
  onSuivant: () => void;
  onPasser: () => void;
}) {
  const nombre = (n: number) => n.toLocaleString('fr-FR');
  const adresses = `${nombre(secteur.adresses)} adresse${secteur.adresses > 1 ? 's' : ''} détectée${secteur.adresses > 1 ? 's' : ''}`;
  const immeubles = `${nombre(secteur.immeubles)} immeuble${secteur.immeubles > 1 ? 's' : ''} avec leur historique de ventes`;

  return (
    <OnboardingShell
      rang={rang}
      total={total}
      titre="Voici votre secteur"
      phrase={
        secteur.immeubles > 0
          ? `${adresses}, ${immeubles}. Tout est déjà là.`
          : `${adresses}. Tout est déjà là.`
      }
      onPasser={onPasser}
      action={
        <button
          type="button"
          onClick={onSuivant}
          className="rounded-lg bg-accent px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-accent-dark"
        >
          Continuer
        </button>
      }
    >
      <OnboardingCarte buildings={buildings} center={center} hauteur={360} />
    </OnboardingShell>
  );
}
