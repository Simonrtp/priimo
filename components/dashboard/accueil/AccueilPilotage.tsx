import type { ReactNode } from 'react';
import type { BilanSemaine } from '@/lib/activite/bilan';
import type { PhrasePilotage as Phrase } from '@/lib/activite/phrase';
import BandeauObjectif from './BandeauObjectif';
import CompteursActivite from './CompteursActivite';
import EnteteSemaine from './EnteteSemaine';
import Entonnoir3D from './Entonnoir3D';
import JourParJour from './JourParJour';
import EmploiDuTemps from './EmploiDuTemps';
import NouvellesAdresses, { type AdresseLivree } from './NouvellesAdresses';
import PhrasePilotageBloc from './PhrasePilotage';
import SelecteurCollaborateur, { type MembreOption } from './SelecteurCollaborateur';

/**
 * L'écran de pilotage.
 *
 * L'ordre n'est pas décoratif : la phrase d'abord, les cinq cartes ensuite,
 * les adresses livrées à gauche de l'emploi du temps, puis l'entonnoir.
 *
 * Composant serveur : tout est déjà calculé en amont. Seuls les blocs
 * réellement interactifs (en-tête, sélecteur, tableau replié) sont clients.
 */
export default function AccueilPilotage({
  bilan,
  phrase,
  adresses,
  totalAdresses,
  membres,
  membreSelectionne,
  estPeriodeCourante,
  aujourdhui,
  citation,
}: {
  bilan: BilanSemaine;
  phrase: Phrase;
  adresses: readonly AdresseLivree[];
  totalAdresses: number;
  membres: readonly MembreOption[];
  membreSelectionne: string;
  estPeriodeCourante: boolean;
  /** Les cartes du jour, réutilisées telles quelles depuis lib/today. */
  aujourdhui: ReactNode;
  citation: string;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-4 pb-10">
      <div className="flex flex-col gap-3">
        <EnteteSemaine
          periode={bilan.periode}
          intervalle={bilan.intervalle}
          estPeriodeCourante={estPeriodeCourante}
          citation={citation}
        />
        {membres.length > 1 ? (
          <div className="flex justify-end">
            <SelecteurCollaborateur membres={membres} selectionne={membreSelectionne} />
          </div>
        ) : null}
      </div>

      <PhrasePilotageBloc phrase={phrase} />
      <BandeauObjectif bilan={bilan} />
      <CompteursActivite familles={bilan.familles} />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <NouvellesAdresses adresses={adresses} total={totalAdresses} />
        <EmploiDuTemps />
      </div>
      <div className="max-md:hidden">
        <Entonnoir3D etapes={bilan.entonnoir} ratios={bilan.ratios} />
      </div>

      {aujourdhui}
      <JourParJour jours={bilan.jours} />
    </div>
  );
}
