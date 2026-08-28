'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BuildingMarker } from '@/lib/carte/buildings';
import type { SortiePlan } from '@/lib/today/sortie';
import type { OnboardingLeadPropose, OnboardingSecteur } from '@/lib/queries/agent-onboarding';
import {
  buildParcours,
  etapeDeReprise,
  etapeSuivante,
  rangEtape,
  type EtapeId,
} from '@/lib/onboarding/parcours';
import EtapeSecteur from './EtapeSecteur';
import EtapeLead from './EtapeLead';
import EtapeNote from './EtapeNote';
import EtapeImmeuble from './EtapeImmeuble';
import EtapeSortie from './EtapeSortie';

/**
 * Prise en main du négociateur.
 *
 * Elle occupe la zone de contenu de l'Accueil : la sidebar reste visible et
 * cliquable, l'agent n'est jamais séquestré. Chaque étape le fait agir sur ses
 * vraies données, et ce qu'il produit reste après — l'adresse prise, la note
 * dictée, la sortie préparée sont là quand l'onboarding se referme.
 *
 * La progression est envoyée au serveur à chaque étape, avec le temps passé :
 * sans cette mesure, on ne saurait jamais où les agents décrochent.
 */
export default function AgentOnboarding({
  profileId,
  secteur,
  leads,
  stageEntreeId,
  buildings,
  center,
  sortiePlan,
  aDesParcelles,
  mobile,
  reprise,
}: {
  profileId: string;
  secteur: OnboardingSecteur;
  leads: readonly OnboardingLeadPropose[];
  stageEntreeId: string | null;
  buildings: readonly BuildingMarker[];
  center: { latitude: number | null; longitude: number | null };
  sortiePlan: SortiePlan | null;
  aDesParcelles: boolean;
  mobile: boolean;
  reprise: { currentStep: string | null; stepsReached: string[] } | null;
}) {
  const router = useRouter();

  const parcours = useMemo(
    () =>
      buildParcours({
        aDesLeads: leads.length > 0 && stageEntreeId != null,
        aDesParcelles,
        aUneSortie: sortiePlan != null && sortiePlan.ordered.length > 0,
        mobile,
      }),
    [leads.length, stageEntreeId, aDesParcelles, sortiePlan, mobile],
  );

  const [etape, setEtape] = useState<EtapeId>(() =>
    etapeDeReprise(parcours, reprise?.currentStep ?? null, reprise?.stepsReached ?? []),
  );
  const [fermeture, setFermeture] = useState(false);

  // Temps passé : on ne compte que depuis le dernier envoi, pour ne pas
  // gonfler la durée d'un onglet laissé ouvert toute la journée.
  const depuis = useRef(Date.now());

  const envoyer = useCallback(
    async (action: string, valeurEtape?: EtapeId) => {
      const secondes = Math.round((Date.now() - depuis.current) / 1000);
      depuis.current = Date.now();
      try {
        await fetch('/api/dashboard/onboarding/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, etape: valeurEtape, secondes }),
        });
      } catch {
        // La progression est un confort de reprise, pas une condition : une
        // panne réseau ne doit pas interrompre la prise en main.
      }
    },
    [],
  );

  // Enregistre l'étape atteinte, y compris la première à l'ouverture.
  useEffect(() => {
    void envoyer('etape', etape);
  }, [etape, envoyer]);

  const total = parcours.length;
  const rang = rangEtape(parcours, etape);

  const terminer = useCallback(async () => {
    setFermeture(true);
    await envoyer('terminer');
    router.refresh();
  }, [envoyer, router]);

  const suivant = useCallback(() => {
    const prochaine = etapeSuivante(parcours, etape);
    if (prochaine) {
      setEtape(prochaine);
      return;
    }
    void terminer();
  }, [parcours, etape, terminer]);

  const passer = useCallback(async () => {
    setFermeture(true);
    // On note l'étape quittée avant de sortir : c'est elle qui dit où ça a lâché.
    await envoyer('passer_etape', etape);
    await envoyer('passer_tout');
    router.refresh();
  }, [envoyer, etape, router]);

  const commun = { rang, total, onPasser: () => void passer() };

  if (etape === 'secteur') {
    return (
      <EtapeSecteur
        {...commun}
        secteur={secteur}
        buildings={buildings}
        center={center}
        onSuivant={suivant}
      />
    );
  }

  if (etape === 'lead') {
    return (
      <EtapeLead
        {...commun}
        leads={leads}
        stageEntreeId={stageEntreeId}
        profileId={profileId}
        onSuivant={suivant}
      />
    );
  }

  if (etape === 'note') {
    return <EtapeNote {...commun} onSuivant={suivant} />;
  }

  if (etape === 'immeuble') {
    return (
      <EtapeImmeuble {...commun} buildings={buildings} center={center} onSuivant={suivant} />
    );
  }

  if (etape === 'sortie' && sortiePlan) {
    return (
      <EtapeSortie
        {...commun}
        plan={sortiePlan}
        enCours={fermeture}
        onTerminer={() => void terminer()}
      />
    );
  }

  // Parcours épuisé (données disparues entre deux sessions) : on referme
  // proprement plutôt que d'afficher un écran sans contenu.
  return (
    <div className="py-8">
      <button
        type="button"
        onClick={() => void terminer()}
        className="rounded-lg bg-accent px-5 py-2.5 text-[14px] font-semibold text-white"
      >
        Ouvrir l’Accueil
      </button>
    </div>
  );
}
