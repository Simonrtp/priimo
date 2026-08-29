'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { BuildingMarker } from '@/lib/carte/buildings';
import type { SortiePlan } from '@/lib/today/sortie';
import type { OnboardingLeadPropose, OnboardingSecteur } from '@/lib/queries/agent-onboarding';
import {
  buildParcours,
  etapeDeReprise,
  etapeSuivante,
  peutPasser,
  rangEtape,
  type EtapeId,
} from '@/lib/onboarding/parcours';
import EtapeSalut from './EtapeSalut';
import EtapeLettre from './EtapeLettre';
import EtapeAnniversaire from './EtapeAnniversaire';
import EtapeAvatar from './EtapeAvatar';
import EtapeSecteur from './EtapeSecteur';
import EtapeLead from './EtapeLead';
import EtapeNote from './EtapeNote';
import EtapeImmeuble from './EtapeImmeuble';
import EtapeSortie from './EtapeSortie';
import EtapeFinal from './EtapeFinal';

function initialsOf(first: string, last: string): string {
  const a = first.trim().charAt(0).toUpperCase();
  const b = last.trim().charAt(0).toUpperCase();
  return `${a}${b}` || '?';
}

/**
 * Prise en main v2 — mobile d’abord, orange marque, état en base.
 */
export default function AgentOnboarding({
  profileId,
  firstName,
  lastName,
  avatarUrl,
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
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
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
  const prenom = firstName.trim() || 'toi';

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
  const [slideKey, setSlideKey] = useState(0);
  const depuis = useRef(Date.now());

  const envoyer = useCallback(async (action: string, valeurEtape?: EtapeId) => {
    const secondes = Math.round((Date.now() - depuis.current) / 1000);
    depuis.current = Date.now();
    try {
      await fetch('/api/dashboard/onboarding/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, etape: valeurEtape, secondes }),
      });
    } catch {
      /* reprise confort */
    }
  }, []);

  useEffect(() => {
    void envoyer('etape', etape);
  }, [etape, envoyer]);

  const allerA = useCallback((prochaine: EtapeId) => {
    setEtape(prochaine);
    setSlideKey((k) => k + 1);
  }, []);

  const terminer = useCallback(async () => {
    setFermeture(true);
    await envoyer('terminer');
    router.refresh();
  }, [envoyer, router]);

  const suivant = useCallback(() => {
    const prochaine = etapeSuivante(parcours, etape);
    if (prochaine) {
      allerA(prochaine);
      return;
    }
    void terminer();
  }, [parcours, etape, allerA, terminer]);

  const passerTout = useCallback(async () => {
    setFermeture(true);
    await envoyer('passer_tout');
    router.refresh();
  }, [envoyer, router]);

  const saveBirthday = useCallback(
    async (data: { month: number; day: number; visibleTeam: boolean }) => {
      try {
        await fetch('/api/dashboard/profile/birthday', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            month: data.month,
            day: data.day,
            visibleTeam: data.visibleTeam,
          }),
        });
      } catch {
        /* non bloquant */
      }
      suivant();
    },
    [suivant],
  );

  const saveAvatar = useCallback(
    async (url: string | null) => {
      if (url !== avatarUrl) {
        try {
          await fetch('/api/dashboard/profile/avatar', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatarUrl: url }),
          });
        } catch {
          /* non bloquant */
        }
      }
      suivant();
    },
    [avatarUrl, suivant],
  );

  const total = parcours.length;
  const rang = rangEtape(parcours, etape);
  const showPasser = peutPasser(etape, parcours) && !fermeture;

  const commun = { rang, total };

  let contenu: ReactNode = null;

  if (etape === 'salut') {
    contenu = <EtapeSalut prenom={prenom} onSuivant={suivant} />;
  } else if (etape === 'lettre') {
    contenu = <EtapeLettre prenom={prenom} onSuivant={suivant} />;
  } else if (etape === 'anniversaire') {
    contenu = (
      <EtapeAnniversaire
        {...commun}
        onSuivant={(d) => void saveBirthday(d)}
        onSkip={suivant}
      />
    );
  } else if (etape === 'avatar') {
    contenu = (
      <EtapeAvatar
        {...commun}
        initials={initialsOf(firstName, lastName)}
        initialUrl={avatarUrl}
        onSuivant={(url) => void saveAvatar(url)}
      />
    );
  } else if (etape === 'secteur') {
    contenu = (
      <EtapeSecteur
        {...commun}
        secteur={secteur}
        buildings={buildings}
        center={center}
        onSuivant={suivant}
      />
    );
  } else if (etape === 'lead') {
    contenu = (
      <EtapeLead
        {...commun}
        leads={leads}
        stageEntreeId={stageEntreeId}
        profileId={profileId}
        onSuivant={suivant}
      />
    );
  } else if (etape === 'note') {
    contenu = <EtapeNote {...commun} onSuivant={suivant} />;
  } else if (etape === 'immeuble') {
    contenu = (
      <EtapeImmeuble {...commun} buildings={buildings} center={center} onSuivant={suivant} />
    );
  } else if (etape === 'sortie' && sortiePlan) {
    contenu = (
      <EtapeSortie
        {...commun}
        plan={sortiePlan}
        enCours={fermeture}
        onTerminer={suivant}
      />
    );
  } else if (etape === 'final') {
    contenu = (
      <EtapeFinal prenom={prenom} enCours={fermeture} onOuvrir={() => void terminer()} />
    );
  } else {
    contenu = (
      <EtapeFinal prenom={prenom} enCours={fermeture} onOuvrir={() => void terminer()} />
    );
  }

  return (
    <div className="onb-root relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      {showPasser ? (
        <button
          type="button"
          onClick={() => void passerTout()}
          className="absolute right-4 top-[max(14px,calc(env(safe-area-inset-top)+10px))] z-10 text-[13px] text-[#9A9A9A] transition hover:text-[#1A1A1A] md:right-8"
        >
          Passer
        </button>
      ) : null}

      <div key={`${etape}-${slideKey}`} className="onb-slide-enter flex min-h-0 flex-1 flex-col">
        {contenu}
      </div>
    </div>
  );
}
