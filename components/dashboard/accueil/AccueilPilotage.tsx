import type { ReactNode } from 'react';
import type { BilanSemaine } from '@/lib/activite/bilan';
import type { PhrasePilotage as Phrase } from '@/lib/activite/phrase';
import BandeauObjectif from './BandeauObjectif';
import CompteursActivite from './CompteursActivite';
import EnteteSemaine from './EnteteSemaine';
import EntonnoirEtRatios from './EntonnoirEtRatios';
import JourParJour from './JourParJour';
import NouvellesAdresses, { type AdresseLivree } from './NouvellesAdresses';
import PhrasePilotageBloc from './PhrasePilotage';
import SelecteurCollaborateur, { type MembreOption } from './SelecteurCollaborateur';
import SemaineUn from './SemaineUn';

/**
 * L'écran de pilotage.
 *
 * L'ordre est celui du prompt et il n'est pas décoratif : la phrase d'abord
 * parce que c'est la seule chose à lire à 9 h, les adresses livrées ensuite
 * parce que c'est le produit vendu, et l'entonnoir tout en bas parce qu'il
 * justifie la phrase sans jamais la remplacer.
 *
 * Composant serveur : tout est déjà calculé en amont. Seuls les trois blocs
 * réellement interactifs (en-tête, sélecteur, tableau replié) sont clients.
 */
export default function AccueilPilotage({
  bilan,
  phrase,
  adresses,
  totalAdresses,
  prenom,
  membres,
  membreSelectionne,
  estPeriodeCourante,
  aujourdhui,
}: {
  bilan: BilanSemaine;
  phrase: Phrase;
  adresses: readonly AdresseLivree[];
  totalAdresses: number;
  prenom: string;
  membres: readonly MembreOption[];
  membreSelectionne: string;
  estPeriodeCourante: boolean;
  /** Les cartes du jour, réutilisées telles quelles depuis lib/today. */
  aujourdhui: ReactNode;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-4 pb-10">
      <div className="flex flex-col gap-3">
        <EnteteSemaine
          periode={bilan.periode}
          intervalle={bilan.intervalle}
          estPeriodeCourante={estPeriodeCourante}
          titre="Ma semaine de prospection"
        />
        {membres.length > 1 ? (
          <div className="flex justify-end">
            <SelecteurCollaborateur membres={membres} selectionne={membreSelectionne} />
          </div>
        ) : null}
      </div>

      {bilan.semaine1 ? (
        <>
          <SemaineUn bilan={bilan} prenom={prenom} />
          <NouvellesAdresses adresses={adresses} total={totalAdresses} />
          {aujourdhui}
        </>
      ) : (
        <>
          <PhrasePilotageBloc phrase={phrase} />
          <BandeauObjectif bilan={bilan} />
          <CompteursActivite familles={bilan.familles} levier={phrase.levier} />
          <NouvellesAdresses adresses={adresses} total={totalAdresses} />
          {aujourdhui}
          <EntonnoirEtRatios
            entonnoir={bilan.entonnoir}
            ratios={bilan.ratios}
            fenetre={bilan.fenetreRatios}
          />
          <JourParJour jours={bilan.jours} />
        </>
      )}
    </div>
  );
}
