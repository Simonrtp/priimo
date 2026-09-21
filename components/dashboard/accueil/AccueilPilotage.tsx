'use client';

import { Fragment, useCallback, useRef, useState, type ReactNode } from 'react';
import type { Pilotage } from '@/lib/activite/pilotage';
import {
  vuePeriode,
  vueSurIntervalle,
  type Periode,
  type VuePeriode,
} from '@/lib/activite/semaines';
import AccueilAube from './AccueilAube';
import BandeauObjectif from './BandeauObjectif';
import CompteursActivite from './CompteursActivite';
import EnteteSemaine from './EnteteSemaine';
import { NotesLectureProvider } from '@/components/dashboard/notes/NotesLectureProvider';
import Entonnoir3D from './Entonnoir3D';
import JourParJour from './JourParJour';
import NouvellesAdresses, { type AdresseLivree } from './NouvellesAdresses';
import PhrasePilotageBloc from './PhrasePilotage';
import SelecteurCollaborateur, { type MembreOption } from './SelecteurCollaborateur';
import TacheDuMoment from './TacheDuMoment';
import type { TodayCard } from '@/lib/today/cards';

/** Une période déjà consultée est réaffichée telle quelle, sans nouvel appel. */
type Cache = Map<string, Pilotage>;

/** La vue du bilan tel qu'il est arrivé du serveur. */
function vueDuBilan(pilotage: Pilotage): VuePeriode {
  return vueSurIntervalle(pilotage.bilan.periode, pilotage.bilan.intervalle);
}

/**
 * L'écran de pilotage.
 *
 * L'ordre n'est pas décoratif : la phrase d'abord, les cinq cartes ensuite,
 * les adresses livrées à gauche de l'emploi du temps, puis l'entonnoir.
 *
 * Composant client, mais seulement pour le sélecteur de période : tout ce qui
 * ne dépend pas de la granularité (les cartes du jour, l'emploi du temps, le
 * secteur) arrive déjà rendu par le serveur et n'est jamais recalculé ici.
 */
export default function AccueilPilotage({
  pilotage,
  adresses,
  totalAdresses,
  sansLivraison,
  membres,
  membreSelectionne,
  moi,
  aujourdhui,
  penseBete,
  emploiDuTemps,
  tache,
  secteur,
  attenteInscription,
}: {
  /** Le bilan calculé par le serveur au premier rendu. */
  pilotage: Pilotage;
  adresses: readonly AdresseLivree[];
  totalAdresses: number;
  /** Aucun lead livré : l’état vide pédagogique, pas « tout est pris ». */
  sansLivraison?: boolean;
  membres: readonly MembreOption[];
  membreSelectionne: string;
  /** Qui regarde : distingue « mes objectifs » de ceux d'un collaborateur. */
  moi: string;
  /** Les cartes du jour, réutilisées telles quelles depuis lib/today. */
  aujourdhui: ReactNode;
  penseBete: string;
  /** L'emploi du temps, rendu par le serveur sous son propre Suspense. */
  emploiDuTemps?: ReactNode;
  /** Ce qu'il y a à faire à cette heure-ci. */
  tache?: TodayCard | null;
  /** La carte du secteur, tout en bas : un repère, pas un outil de travail. */
  secteur?: ReactNode;
  attenteInscription?: ReactNode;
}) {
  const cleServeur = vueDuBilan(pilotage).cle;
  const cache = useRef<Cache>(new Map([[cleServeur, pilotage]]));
  // Ce que l'agent a demandé : posé au clic, sans attendre le réseau.
  const [vue, setVue] = useState<VuePeriode>(() => vueDuBilan(pilotage));
  const [affiche, setAffiche] = useState<Pilotage>(pilotage);
  const dernierServeur = useRef(cleServeur);
  /** La dernière période demandée : une réponse doublée est jetée. */
  const demande = useRef(cleServeur);

  // Le serveur a renvoyé une autre période (changement de collaborateur,
  // rechargement) : c'est lui qui a raison, on repart de sa réponse.
  if (dernierServeur.current !== cleServeur) {
    dernierServeur.current = cleServeur;
    demande.current = cleServeur;
    cache.current.set(cleServeur, pilotage);
    setVue(vueDuBilan(pilotage));
    setAffiche(pilotage);
  }

  /** Le bilan d'une période, demandé au serveur. */
  const charger = useCallback(
    async (cible: VuePeriode, ancre: string | null) => {
      const q = new URLSearchParams({ periode: cible.periode });
      if (ancre) q.set('le', ancre);
      if (membres.length > 1) q.set('membre', membreSelectionne);

      try {
        const res = await fetch(`/api/dashboard/activite?${q.toString()}`);
        if (!res.ok) throw new Error('activite');
        const recu = (await res.json()) as Pilotage;
        cache.current.set(vueDuBilan(recu).cle, recu);
        // Un clic plus récent a déjà pris la main : cette réponse ne vaut plus
        // que pour le cache.
        if (demande.current !== cible.cle) return;
        setAffiche(recu);
      } catch {
        // On laisse les chiffres précédents : un bilan faux serait pire qu'un
        // bilan qui n'a pas bougé, et l'en-tête dit quelle période a échoué.
      }
    },
    [membreSelectionne, membres.length],
  );

  const changer = useCallback(
    async (periode: Periode, ancre: string | null) => {
      const suivante = vuePeriode(periode, ancre);
      demande.current = suivante.cle;
      setVue(suivante);

      const q = new URLSearchParams({ periode });
      if (ancre) q.set('le', ancre);
      if (membres.length > 1) q.set('membre', membreSelectionne);

      // L'URL suit sans rendu serveur : la période reste partageable, et un
      // rechargement retrouve la même granularité.
      window.history.replaceState(null, '', `/dashboard?${q.toString()}`);

      const connu = cache.current.get(suivante.cle);
      if (connu) {
        setAffiche(connu);
        return;
      }

      await charger(suivante, ancre);
    },
    [charger, membreSelectionne, membres.length],
  );

  // Un objectif qui change périme tous les bilans déjà lus, pas seulement
  // celui à l'écran : les cartes des autres périodes se comparent aux mêmes
  // cibles. On vide le cache et on redemande la période affichée.
  const rafraichir = useCallback(() => {
    cache.current.clear();
    demande.current = vue.cle;
    void charger(vue, vue.intervalle.debut);
  }, [charger, vue]);

  const { bilan, phrase } = affiche;
  // Les chiffres à l'écran sont-ils ceux de la période demandée ?
  const enCours = vueDuBilan(affiche).cle !== vue.cle;
  // Mieux vaut un écran qui se dit en retard qu'un écran qui annonce une
  // période et montre les compteurs d'une autre.
  const estompe = `transition-opacity duration-fluid-subtle ${
    enCours ? 'opacity-50' : 'opacity-100'
  }`;

  return (
    <NotesLectureProvider>
    <div data-accueil className="flex w-full min-w-0 flex-col gap-4 pb-10">
      <div className="flex flex-col gap-3">
        <EnteteSemaine
          periode={vue.periode}
          intervalle={vue.intervalle}
          estPeriodeCourante={vue.estPeriodeCourante}
          enCours={enCours}
          onChanger={changer}
        />
        {membres.length > 1 ? (
          <div className="flex justify-end">
            <SelecteurCollaborateur membres={membres} selectionne={membreSelectionne} />
          </div>
        ) : null}
      </div>

      {attenteInscription ? (
        <Fragment key="accueil-attente">{attenteInscription}</Fragment>
      ) : null}
      <TacheDuMoment card={tache ?? null} />

      <div aria-busy={enCours} className={`flex min-w-0 flex-col gap-4 ${estompe}`}>
        <PhrasePilotageBloc phrase={phrase} />
        <AccueilAube>
          <BandeauObjectif
            bilan={bilan}
            membre={membreSelectionne}
            membreNom={
              membreSelectionne === moi
                ? null
                : (membres.find((m) => m.id === membreSelectionne)?.nom ?? null)
            }
            onObjectifsChanges={rafraichir}
          />
        </AccueilAube>
        <CompteursActivite familles={bilan.familles} penseBete={penseBete} />
      </div>

      {/* Les deux cartes s'alignent par étirement : la plus haute donne le
          bord bas, l'autre s'y étire. Aucune hauteur n'est imposée ici — une
          rangée figée déborderait dès que l'agenda demande plus de place. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <NouvellesAdresses
          adresses={adresses}
          total={totalAdresses}
          sansLivraison={sansLivraison}
        />
        {emploiDuTemps ? <Fragment key="accueil-emploi">{emploiDuTemps}</Fragment> : null}
      </div>
      <div aria-busy={enCours} className={`max-md:hidden ${estompe}`}>
        <Entonnoir3D etapes={bilan.entonnoir} ratios={bilan.ratios} />
      </div>

      {aujourdhui ? <Fragment key="accueil-aujourdhui">{aujourdhui}</Fragment> : null}
      <div aria-busy={enCours} className={estompe}>
        <JourParJour
          jours={bilan.joursGlissants}
          jourActif={vue.periode === 'jour' ? vue.intervalle.debut : null}
          onChoisirJour={(jour) => void changer('jour', jour)}
        />
      </div>
      {secteur ? <Fragment key="accueil-secteur">{secteur}</Fragment> : null}
    </div>
    </NotesLectureProvider>
  );
}
