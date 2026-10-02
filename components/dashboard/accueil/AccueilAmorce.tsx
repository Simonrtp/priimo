import { normaliserPeriode, TITRE_PERIODE } from '@/lib/activite/semaines';
import { intervalleAffiche } from '@/lib/activite/pilotage';
import AccueilSquelette, { EnteteSquelette } from './AccueilSquelette';

/** En-tête + squelette : visibles avant les blocs lourds de l’Accueil. */
export default function AccueilAmorce({
  periodeDemandee,
  ancreDemandee = null,
  finDemandee = null,
  mobile,
}: {
  periodeDemandee: string | null;
  ancreDemandee?: string | null;
  finDemandee?: string | null;
  mobile: boolean;
}) {
  const periode = normaliserPeriode(periodeDemandee);
  const intervalle = intervalleAffiche(periode, ancreDemandee, finDemandee);
  const titre =
    periode === 'custom' && intervalle.debut === intervalle.fin
      ? 'Ma journée'
      : TITRE_PERIODE[periode];

  return (
    <div data-accueil className="flex w-full min-w-0 flex-col gap-4 pb-10">
      <EnteteSquelette
        titre={titre}
        periodeActive={periode}
      />
      <AccueilSquelette mobile={mobile} />
    </div>
  );
}
