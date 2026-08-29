'use client';

import { MapPin } from 'lucide-react';
import type { SortiePlan } from '@/lib/today/sortie';
import OnboardingShell from './OnboardingShell';

/**
 * Étape 4 — sa sortie est prête.
 *
 * La tournée est calculée depuis l'adresse de l'agence, sur ses adresses à
 * lui. Le bouton final referme la prise en main et rend l'Accueil normal —
 * avec l'adresse qu'il a prise, la note qu'il a dictée et cette sortie.
 */
export default function EtapeSortie({
  rang,
  total,
  plan,
  onTerminer,
  enCours,
}: {
  rang: number;
  total: number;
  plan: SortiePlan;
  onTerminer: () => void;
  enCours: boolean;
}) {
  const stops = plan.ordered;
  const km = plan.distanceM >= 1000 ? `${(plan.distanceM / 1000).toFixed(1)} km` : `${plan.distanceM} m`;

  return (
    <OnboardingShell
      rang={rang}
      total={total}
      titre="Votre parcours du jour"
      phrase="Vos adresses sont dans l’ordre, l’itinéraire est prêt."
      action={
        <button
          type="button"
          onClick={onTerminer}
          disabled={enCours}
          className="rounded-lg bg-[#6366F1] px-6 py-2.5 text-[14px] font-semibold text-white transition hover:brightness-[0.97] disabled:opacity-60"
        >
          {enCours ? 'Un instant…' : 'Commencer'}
        </button>
      }
    >
      <div className="h-full min-h-0 overflow-y-auto overscroll-contain md:overflow-visible">
        <div className="rounded-clay border border-black/[0.06] bg-surface p-4 shadow-clay-sm">
          <p className="text-[12.5px] text-text-muted">
            {stops.length} arrêt{stops.length > 1 ? 's' : ''} · {km} à parcourir
          </p>
          <ol className="mt-3 flex flex-col">
            {stops.map((stop, i) => (
              <li
                key={stop.key}
                className="flex items-start gap-3 border-b border-black/[0.05] py-2.5 last:border-0"
              >
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-[12px] font-semibold tabular-nums text-ink">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="flex items-start gap-1.5 text-[14px] text-ink">
                    <MapPin size={14} className="mt-0.5 shrink-0 text-text-subtle" aria-hidden />
                    <span className="min-w-0 break-words">{stop.address}</span>
                  </span>
                  {stop.mainSignalLabel ? (
                    <span className="mt-0.5 block text-[12.5px] text-text-muted">
                      {stop.mainSignalLabel}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </OnboardingShell>
  );
}
