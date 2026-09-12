import { citationDuJour } from '@/lib/activite/citations';
import { intervalleAffiche } from '@/lib/activite/pilotage';
import { estPeriode } from '@/lib/activite/semaines';
import { parisYmd, ymdKey } from '@/lib/today/calendar';
import { TodayDesktopSkeleton, TodayMobileSkeleton } from '@/components/dashboard/today/TodaySkeletons';
import CitationCard from './CitationCard';

/** En-tête + squelette : visibles avant les blocs lourds de l’Accueil. */
export default function AccueilAmorce({
  prenom,
  periodeDemandee,
  mobile,
}: {
  prenom: string;
  periodeDemandee: string | null;
  mobile: boolean;
}) {
  const periode = estPeriode(periodeDemandee) ? periodeDemandee : 'semaine';
  const intervalle = intervalleAffiche(periode, null);
  const citation = citationDuJour({
    jour: ymdKey(parisYmd(new Date())),
    prenoms: prenom ? [prenom] : [],
  });
  const titre =
    periode === 'jour'
      ? 'Ma journée'
      : periode === 'mois'
        ? 'Mon mois'
        : periode === 'annee'
          ? 'Mon année'
          : 'Ma semaine';

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-2 pt-2">
        <p className="text-[22px] font-semibold tracking-tight text-text-strong">{titre}</p>
        <p className="text-[12.5px] text-text-subtle">
          {intervalle.debut === intervalle.fin ? intervalle.debut : `${intervalle.debut} – ${intervalle.fin}`}
        </p>
        <CitationCard texte={citation} />
      </div>
      {mobile ? <TodayMobileSkeleton masquerEntete /> : <TodayDesktopSkeleton masquerEntete />}
    </div>
  );
}
