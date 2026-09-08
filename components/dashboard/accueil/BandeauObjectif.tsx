import { Award } from 'lucide-react';
import type { BilanSemaine } from '@/lib/activite/bilan';

const VERT = '#2F7A5A';

/**
 * Une seule ligne, pas trois cartes : la progression de la période à gauche,
 * l'objectif mensuel de mandats à droite. Le mandat garde sa ligne propre
 * parce qu'il se pilote au mois, pas à la semaine.
 */
export default function BandeauObjectif({ bilan }: { bilan: BilanSemaine }) {
  const { progressionHebdo, mandatsDuMois, objectifsParDefaut } = bilan;
  const pctMandats =
    mandatsDuMois.objectif > 0
      ? Math.min(100, Math.round((mandatsDuMois.valeur / mandatsDuMois.objectif) * 100))
      : 0;

  return (
    <section className="flex flex-col gap-4 rounded-clay-lg bg-surface px-5 py-4 shadow-clay-sm sm:flex-row sm:items-center sm:gap-8">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[12px] font-semibold text-text-muted">Objectif de la période</p>
          <p className="font-display text-[17px] font-bold text-text-strong">
            {progressionHebdo} %
          </p>
        </div>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-bg-subtle"
          role="progressbar"
          aria-valuenow={progressionHebdo}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progression de la période : ${progressionHebdo} %`}
        >
          <span
            className="block h-full rounded-full bg-primary-500 transition-[width] duration-fluid"
            style={{ width: `${progressionHebdo}%` }}
          />
        </div>
        {objectifsParDefaut ? (
          <p className="mt-1.5 text-[11px] text-text-subtle">
            Objectifs proposés par défaut — votre directeur peut les ajuster.
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-3 sm:border-l sm:border-black/[0.06] sm:pl-8">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
          style={{ backgroundColor: '#D5EADF', color: VERT }}
        >
          <Award size={18} strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-text-muted">Mandats ce mois</p>
          <p className="font-display text-[17px] font-bold leading-tight text-text-strong">
            {mandatsDuMois.valeur}
            <span className="text-[13px] font-medium text-text-subtle">
              {' '}
              / {mandatsDuMois.objectif}
            </span>
            <span className="sr-only"> — {pctMandats} % de l’objectif mensuel</span>
          </p>
        </div>
      </div>
    </section>
  );
}
