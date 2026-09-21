import { estPeriode, type Intervalle, type Periode } from '@/lib/activite/semaines';
import { intervalleAffiche } from '@/lib/activite/pilotage';
import AccueilSquelette, { EnteteSquelette } from './AccueilSquelette';

function jourLisible(cle: string): string {
  const [y, m, d] = cle.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12)).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

/** Même libellé que l’en-tête chargé, pour ne pas sauter au premier rendu. */
function intervalleLisible(intervalle: Intervalle, periode: Periode): string {
  const [ay, am] = intervalle.debut.split('-').map(Number);
  const [by, bm] = intervalle.fin.split('-').map(Number);

  if (periode === 'jour') return `${jourLisible(intervalle.debut)} ${ay}`;
  if (periode === 'annee') return String(ay);
  if (periode === 'mois') {
    return new Date(Date.UTC(ay ?? 1970, (am ?? 1) - 1, 15, 12)).toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  const debut =
    am === bm && ay === by
      ? String(Number(intervalle.debut.slice(8)))
      : jourLisible(intervalle.debut);
  return `${debut} – ${jourLisible(intervalle.fin)} ${by}`;
}

/** En-tête + squelette : visibles avant les blocs lourds de l’Accueil. */
export default function AccueilAmorce({
  periodeDemandee,
  mobile,
}: {
  periodeDemandee: string | null;
  mobile: boolean;
}) {
  const periode = estPeriode(periodeDemandee) ? periodeDemandee : 'semaine';
  const intervalle = intervalleAffiche(periode, null);
  const titre =
    periode === 'jour'
      ? 'Ma journée'
      : periode === 'mois'
        ? 'Mon mois'
        : periode === 'annee'
          ? 'Mon année'
          : 'Ma semaine';

  return (
    <div data-accueil className="flex w-full min-w-0 flex-col gap-4 pb-10">
      <EnteteSquelette
        titre={titre}
        intervalle={intervalleLisible(intervalle, periode)}
        periodeActive={periode}
      />
      <AccueilSquelette mobile={mobile} />
    </div>
  );
}
