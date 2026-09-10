import { Award } from 'lucide-react';
import type { BilanSemaine } from '@/lib/activite/bilan';

const VERT = '#2F7A5A';

/**
 * Violet de l'objectif, aux mêmes paliers que `COULEUR_FAMILLE` : voile pour
 * l'aplat, pastel appuyé derrière l'icône, pastille pour la piste, teinte
 * pleine pour la barre. Le violet ne recoupe ni les cinq familles, ni l'indigo
 * de marque, ni l'orange des leads.
 */
const OBJECTIF = {
  teinte: '#7C4DD3',
  pastelFort: '#DCCFF7',
  pastille: '#EBE3FA',
  voile: '#F5F1FD',
} as const;

/**
 * Une seule ligne, pas trois cartes : la progression de la période à gauche,
 * l'objectif mensuel de mandats à droite. Le mandat garde sa ligne propre
 * parce qu'il se pilote au mois, pas à la semaine.
 *
 * Même dessin que les compteurs juste en dessous : aplat voilé, icône posée
 * sur un carré pastel, piste plus claire que la barre.
 */
export default function BandeauObjectif({ bilan }: { bilan: BilanSemaine }) {
  const { progressionHebdo, mandatsDuMois } = bilan;
  const pctMandats =
    mandatsDuMois.objectif > 0
      ? Math.min(100, Math.round((mandatsDuMois.valeur / mandatsDuMois.objectif) * 100))
      : 0;

  return (
    <section
      className="flex flex-col gap-4 rounded-clay-lg px-5 py-4 shadow-clay-sm sm:flex-row sm:items-center sm:gap-8"
      style={{ backgroundColor: OBJECTIF.voile }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-[12px]"
          style={{ backgroundColor: OBJECTIF.pastelFort }}
        >
          <img src="/cible.png" alt="" width={28} height={28} className="size-7" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[12px] font-semibold text-text-muted">Objectif de la période</p>
            <p
              className="font-display text-[17px] font-bold"
              style={{ color: OBJECTIF.teinte }}
            >
              {progressionHebdo} %
            </p>
          </div>
          <div
            // Piste un cran plus foncée que l'aplat, sinon la barre flotte sur
            // un fond qu'on ne distingue plus.
            className="mt-2 h-2 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: OBJECTIF.pastille }}
            role="progressbar"
            aria-valuenow={progressionHebdo}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progression de la période : ${progressionHebdo} %`}
          >
            <span
              className="block h-full rounded-full transition-[width] duration-fluid"
              style={{ width: `${progressionHebdo}%`, backgroundColor: OBJECTIF.teinte }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:border-l sm:border-black/[0.06] sm:pl-8">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-[12px]"
          style={{ backgroundColor: '#D5EADF', color: VERT }}
        >
          <Award size={20} strokeWidth={2.2} />
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
