'use client';

import OnboardingShell, { OnboardingPrimaryButton } from './OnboardingShell';
import OnboardingCarte from './OnboardingCarte';
import type { BuildingMarker } from '@/lib/carte/buildings';
import type { OnboardingSecteur } from '@/lib/queries/agent-onboarding';

/**
 * Étape 0 — le secteur est déjà là.
 *
 * Carte Mapbox du secteur + stats open data déjà disponibles (DPE, copros,
 * ventes, immeubles, adresses). Pas de mention Mapbox, pas de démo.
 */
export default function EtapeSecteur({
  rang,
  total,
  secteur,
  buildings,
  center,
  onSuivant,
}: {
  rang: number;
  total: number;
  secteur: OnboardingSecteur;
  buildings: readonly BuildingMarker[];
  center: { latitude: number | null; longitude: number | null };
  onSuivant: () => void;
}) {
  const nombre = (n: number) => n.toLocaleString('fr-FR');

  const stats: { label: string; value: number }[] = [
    { label: 'Adresses', value: secteur.adresses },
    { label: 'Immeubles', value: secteur.immeubles },
    { label: 'DPE', value: secteur.dpe },
    { label: 'Copropriétés', value: secteur.copros },
    { label: 'Ventes', value: secteur.ventes },
  ].filter((s) => s.value > 0);

  return (
    <OnboardingShell
      rang={rang}
      total={total}
      compact
      fill
      titre="Voici votre secteur"
      phrase="Les données de votre zone sont déjà là — DPE, copropriétés, ventes."
      action={<OnboardingPrimaryButton onClick={onSuivant}>Continuer</OnboardingPrimaryButton>}
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        {stats.length > 0 ? (
          <ul
            className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5"
            aria-label="Chiffres du secteur"
          >
            {stats.map((s) => (
              <li
                key={s.label}
                className="rounded-xl border border-black/[0.06] bg-white/80 px-3 py-2.5 shadow-clay-sm"
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-[#8A8A8A]">
                  {s.label}
                </p>
                <p className="mt-0.5 tabular text-[20px] font-semibold leading-none text-[#1A1A1A]">
                  {nombre(s.value)}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="relative min-h-[240px] flex-1 md:min-h-[380px]">
          <div className="absolute inset-0">
            <OnboardingCarte buildings={buildings} center={center} />
          </div>
        </div>
      </div>
    </OnboardingShell>
  );
}
