import { Suspense, type ReactNode } from 'react';
import type { BilanSemaine } from '@/lib/activite/bilan';
import type { PhrasePilotage as Phrase } from '@/lib/activite/phrase';
import type { AgendaReponse } from '@/lib/agenda/types';
import BandeauObjectif from './BandeauObjectif';
import CompteursActivite from './CompteursActivite';
import EnteteSemaine from './EnteteSemaine';
import Entonnoir3D from './Entonnoir3D';
import JourParJour from './JourParJour';
import { EmploiDuTempsSquelette } from './EmploiDuTemps';
import EmploiDuTempsServeur from './EmploiDuTempsServeur';
import NouvellesAdresses, { type AdresseLivree } from './NouvellesAdresses';
import PhrasePilotageBloc from './PhrasePilotage';
import SelecteurCollaborateur, { type MembreOption } from './SelecteurCollaborateur';
import TacheDuMoment from './TacheDuMoment';
import type { TodayCard } from '@/lib/today/cards';

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
  agenda,
  tache,
  secteur,
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
  agenda?: Promise<AgendaReponse>;
  /** Ce qu'il y a à faire à cette heure-ci. */
  tache?: TodayCard | null;
  /** La carte du secteur, tout en bas : un repère, pas un outil de travail. */
  secteur?: ReactNode;
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

      <TacheDuMoment card={tache ?? null} />
      <PhrasePilotageBloc phrase={phrase} />
      <BandeauObjectif bilan={bilan} />
      <CompteursActivite familles={bilan.familles} />

      {/* Les deux cartes s'alignent par étirement : la plus haute donne le
          bord bas, l'autre s'y étire. Aucune hauteur n'est imposée ici — une
          rangée figée déborderait dès que l'agenda demande plus de place. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <NouvellesAdresses adresses={adresses} total={totalAdresses} />
        <Suspense fallback={<EmploiDuTempsSquelette />}>
          <EmploiDuTempsServeur agenda={agenda} />
        </Suspense>
      </div>
      <div className="max-md:hidden">
        <Entonnoir3D etapes={bilan.entonnoir} ratios={bilan.ratios} />
      </div>

      {aujourdhui}
      <JourParJour jours={bilan.jours} />
      {secteur}
    </div>
  );
}
