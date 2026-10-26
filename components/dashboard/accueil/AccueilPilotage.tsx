'use client';

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Pilotage } from '@/lib/activite/pilotage';
import {
  vuePeriode,
  vueSurIntervalle,
  type Periode,
  type VuePeriode,
} from '@/lib/activite/semaines';
import BandeauObjectif from './BandeauObjectif';
import CarteCompetition from './CarteCompetition';
import CarteMiseEnPlace from './CarteMiseEnPlace';
import CompteursActivite from './CompteursActivite';
import EnteteSemaine, { titreDe } from './EnteteSemaine';
import PenseBete from './PenseBete';
import { NotesLectureProvider } from '@/components/dashboard/notes/NotesLectureProvider';
import JourParJour from './JourParJour';
import NouvellesAdresses, { type AdresseLivree } from './NouvellesAdresses';
import SelecteurCollaborateur, { type MembreOption } from './SelecteurCollaborateur';
import SelecteurVueAccueil from '@/components/dashboard/directeur/SelecteurVueAccueil';

function queryPeriode(cible: VuePeriode, membre: string | null): URLSearchParams {
  const q = new URLSearchParams({ periode: cible.periode });
  if (cible.periode === 'custom') {
    q.set('le', cible.intervalle.debut);
    if (cible.intervalle.fin !== cible.intervalle.debut) q.set('a', cible.intervalle.fin);
  }
  if (membre) q.set('membre', membre);
  return q;
}

/** Une période déjà consultée est réaffichée telle quelle, sans nouvel appel. */
type Cache = Map<string, Pilotage>;

/** La vue du bilan tel qu'il est arrivé du serveur. */
function vueDuBilan(pilotage: Pilotage): VuePeriode {
  return vueSurIntervalle(pilotage.bilan.periode, pilotage.bilan.intervalle);
}

/**
 * L'écran de pilotage.
 *
 * L'ordre n'est pas décoratif : le titre, le pense-bête juste à sa
 * droite, le sélecteur de période au bout, sur mobile les tâches du jour
 * (un rappel passe avant les chiffres), puis ce qu'il reste à brancher
 * (agenda, secteur) et seulement ensuite les objectifs. Le podium reste
 * au bureau. Puis les cartes, les adresses à gauche
 * de l'emploi du temps. L'entonnoir de conversion reste calculé, il n'est pas affiché.
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
  plusieursSecteurs = false,
  membres,
  membreSelectionne,
  moi,
  aujourdhui,
  taches,
  penseBete,
  emploiDuTemps,
  secteur,
  attenteInscription,
  selecteurVueDirecteur = false,
  miseEnPlace = null,
  lectureDe = null,
  sansCollaborateur = false,
  mobile = false,
}: {
  /** Le bilan calculé par le serveur au premier rendu. */
  pilotage: Pilotage;
  adresses: readonly AdresseLivree[];
  totalAdresses: number;
  /** Aucun lead livré : l’état vide pédagogique, pas « tout est pris ». */
  sansLivraison?: boolean;
  /** L'agent tient plusieurs secteurs : « mes secteurs » plutôt que « mon secteur ». */
  plusieursSecteurs?: boolean;
  membres: readonly MembreOption[];
  membreSelectionne: string;
  /** Qui regarde : distingue « mes objectifs » de ceux d'un collaborateur. */
  moi: string;
  /** Les cartes du jour, réutilisées telles quelles depuis lib/today. */
  aujourdhui?: ReactNode;
  /** Mobile : les tâches du jour, entre le pense-bête et les objectifs. */
  taches?: ReactNode;
  penseBete: string | null;
  /** L'emploi du temps, rendu par le serveur sous son propre Suspense. */
  emploiDuTemps?: ReactNode;
  /** La carte du secteur, tout en bas : un repère, pas un outil de travail. */
  secteur?: ReactNode;
  attenteInscription?: ReactNode;
  /** Affiche L'agence / Ma semaine pour le directeur. */
  selecteurVueDirecteur?: boolean;
  /** Ce qui manque encore : le secteur. Absent = tout est en place. */
  miseEnPlace?: { aUnSecteur: boolean } | null;
  /** Prénom du collaborateur dont le directeur lit le tableau. */
  lectureDe?: string | null;
  /** Aucun collaborateur dans l'agence : le podium reste, sans personne dessus. */
  sansCollaborateur?: boolean;
  /** Téléphone : pas de podium, l'objectif sous « Ce qu'il reste à faire ». */
  mobile?: boolean;
}) {
  const cleServeur = vueDuBilan(pilotage).cle;
  const cache = useRef<Cache>(new Map([[cleServeur, pilotage]]));
  // Ce que l'agent a demandé : posé au clic, sans attendre le réseau.
  const [vue, setVue] = useState<VuePeriode>(() => vueDuBilan(pilotage));
  const [affiche, setAffiche] = useState<Pilotage>(pilotage);
  const dernierServeur = useRef(cleServeur);
  const dernierPilotage = useRef(pilotage);
  const dernierMembre = useRef(membreSelectionne);
  /** La dernière période demandée : une réponse doublée est jetée. */
  const demande = useRef(cleServeur);

  // Autre collaborateur : les périodes déjà vues appartiennent à quelqu'un d'autre.
  if (dernierMembre.current !== membreSelectionne) {
    dernierMembre.current = membreSelectionne;
    cache.current.clear();
    dernierServeur.current = cleServeur;
    dernierPilotage.current = pilotage;
    demande.current = cleServeur;
    cache.current.set(cleServeur, pilotage);
    setVue(vueDuBilan(pilotage));
    setAffiche(pilotage);
  }

  // Le serveur a renvoyé une autre période (rechargement) : c'est lui qui a raison.
  if (dernierServeur.current !== cleServeur) {
    dernierServeur.current = cleServeur;
    dernierPilotage.current = pilotage;
    demande.current = cleServeur;
    cache.current.set(cleServeur, pilotage);
    setVue(vueDuBilan(pilotage));
    setAffiche(pilotage);
  } else if (dernierPilotage.current !== pilotage) {
    // Même période, chiffres frais (une note vient d'être rangée, la page s'est
    // rafraîchie) : on les adopte si c'est la période à l'écran. Sans cela le
    // compteur ne bougeait qu'au rechargement complet.
    dernierPilotage.current = pilotage;
    cache.current.set(cleServeur, pilotage);
    if (demande.current === cleServeur) setAffiche(pilotage);
  }

  /** Le bilan d'une période, demandé au serveur. */
  const charger = useCallback(
    async (cible: VuePeriode) => {
      const q = queryPeriode(cible, membres.length > 1 ? membreSelectionne : null);

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
    async (periode: Periode, ancre: string | null, fin: string | null = null) => {
      const suivante = vuePeriode(periode, ancre, new Date(), fin);
      demande.current = suivante.cle;
      setVue(suivante);

      const q = queryPeriode(suivante, membres.length > 1 ? membreSelectionne : null);

      // L'URL suit sans rendu serveur : la période reste partageable, et un
      // rechargement retrouve la même fenêtre.
      window.history.replaceState(null, '', `/dashboard?${q.toString()}`);

      const connu = cache.current.get(suivante.cle);
      if (connu) {
        setAffiche(connu);
        return;
      }

      await charger(suivante);
    },
    [charger, membreSelectionne, membres.length],
  );

  const rafraichir = useCallback(() => {
    cache.current.clear();
    demande.current = vue.cle;
    void charger(vue);
  }, [charger, vue]);

  // Après une qualification sur la prospection, l’Accueil peut rester sur un
  // payload client périmé : on reprend les chiffres dès que l’écran revient.
  useEffect(() => {
    const surRetour = () => {
      if (document.visibilityState !== 'visible') return;
      rafraichir();
    };
    document.addEventListener('visibilitychange', surRetour);
    window.addEventListener('pageshow', surRetour);
    return () => {
      document.removeEventListener('visibilitychange', surRetour);
      window.removeEventListener('pageshow', surRetour);
    };
  }, [rafraichir]);

  // Même cas en navigation soft Accueil ← Prospection (composant remounté
  // avec un RSC encore en cache client) : un fetch au montage force le vrai score.
  useEffect(() => {
    rafraichir();
    // Une seule fois au montage — rafraichir change à chaque période.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  const { bilan } = affiche;
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
          debut={
            selecteurVueDirecteur ? (
              <SelecteurVueAccueil
                vue="agent"
                libelleAgent={
                  lectureDe ? titreDe(vue.periode, vue.intervalle, lectureDe) : 'Ma semaine'
                }
              />
            ) : undefined
          }
          apresTitre={
            selecteurVueDirecteur ? (
              <SelecteurCollaborateur
                membres={membres}
                selectionne={membreSelectionne}
                moi={moi}
              />
            ) : undefined
          }
          droite={penseBete != null ? <PenseBete initial={penseBete} /> : undefined}
          de={lectureDe}
        />
      </div>

      {taches ? <Fragment key="accueil-taches">{taches}</Fragment> : null}

      {attenteInscription ? (
        <Fragment key="accueil-attente">{attenteInscription}</Fragment>
      ) : null}

      <div aria-busy={enCours} className={`flex min-w-0 flex-col gap-4 ${estompe}`}>
        {mobile && miseEnPlace && membreSelectionne === moi ? (
          <CarteMiseEnPlace aUnSecteur={miseEnPlace.aUnSecteur} />
        ) : null}
        <div className={mobile ? 'min-w-0' : 'grid grid-cols-2 items-end gap-3 sm:gap-5 lg:grid-cols-4'}>
          <div className={mobile ? 'min-w-0' : 'col-span-2 min-w-0 lg:col-span-3'}>
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
          </div>
          {mobile ? null : (
            <CarteCompetition
              podium={affiche.podium ?? []}
              classement
              vide={sansCollaborateur}
            />
          )}
        </div>
        {!mobile && miseEnPlace && membreSelectionne === moi ? (
          <CarteMiseEnPlace aUnSecteur={miseEnPlace.aUnSecteur} />
        ) : null}
        <CompteursActivite
          familles={bilan.familles}
          accueilleNotes={vue.estPeriodeCourante && membreSelectionne === moi}
          periode={`${vueDuBilan(affiche).cle}:${membreSelectionne}`}
          montrerActions={!lectureDe}
          secteurs={affiche.secteurs ?? []}
          intervalle={vue.intervalle}
          membreId={membreSelectionne}
        />
      </div>

      {/* Les deux cartes s'alignent par étirement : la plus haute donne le
          bord bas, l'autre s'y étire. Aucune hauteur n'est imposée ici — une
          rangée figée déborderait dès que l'agenda demande plus de place. */}
      {lectureDe && !emploiDuTemps ? null : (
      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        {lectureDe ? null : (
        <NouvellesAdresses
          adresses={adresses}
          total={totalAdresses}
          sansLivraison={sansLivraison}
          plusieursSecteurs={plusieursSecteurs}
        />
        )}
        {emploiDuTemps ? <Fragment key="accueil-emploi">{emploiDuTemps}</Fragment> : null}
      </div>
      )}
      {aujourdhui ? <Fragment key="accueil-aujourdhui">{aujourdhui}</Fragment> : null}
      {/* Une demi-page, comme les cartes du dessus. Pas de content-visibility
          ici : son confinement coupait l'ombre de la carte. */}
      {secteur ? (
        <div key="accueil-secteur" className={lectureDe ? 'min-w-0' : 'grid gap-4 lg:grid-cols-2'}>
          <div className="min-w-0">{secteur}</div>
        </div>
      ) : null}
      <div aria-busy={enCours} className={estompe}>
        <JourParJour
          jours={bilan.joursGlissants}
          jourActif={
            vue.periode === 'custom' && vue.intervalle.debut === vue.intervalle.fin
              ? vue.intervalle.debut
              : null
          }
          onChoisirJour={(jour) => void changer('custom', jour, jour)}
          de={lectureDe}
        />
      </div>
    </div>
    </NotesLectureProvider>
  );
}
