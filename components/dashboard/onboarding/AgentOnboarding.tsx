'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  buildParcours,
  etapeDeReprise,
  etapePrecedente,
  etapeSuivante,
  rangEtape,
  type EtapeId,
} from '@/lib/onboarding/parcours';
import { ArrowLeft } from 'lucide-react';
import EtapeSalut from './EtapeSalut';
import EtapeLettre from './EtapeLettre';
import EtapeAnniversaire from './EtapeAnniversaire';
import EtapeAvatar from './EtapeAvatar';
import EtapeFonctionnalites from './EtapeFonctionnalites';
import EtapeFormation from './EtapeFormation';
import EtapeFinal from './EtapeFinal';

function initialsOf(first: string, last: string): string {
  const a = first.trim().charAt(0).toUpperCase();
  const b = last.trim().charAt(0).toUpperCase();
  return `${a}${b}` || '?';
}

/**
 * Prise en main — ouverture, fonctionnalités, formation, écran final.
 */
export default function AgentOnboarding({
  firstName,
  lastName,
  avatarUrl,
  reprise,
}: {
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  reprise: { currentStep: string | null; stepsReached: string[] } | null;
}) {
  const router = useRouter();
  const prenom = firstName.trim() || 'toi';
  const parcours = useMemo(() => buildParcours(), []);

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

  const precedent = useCallback(() => {
    const precedente = etapePrecedente(parcours, etape);
    if (precedente) allerA(precedente);
  }, [parcours, etape, allerA]);

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
  const showRetour = etapePrecedente(parcours, etape) != null && !fermeture;
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
  } else if (etape === 'fonctionnalites') {
    contenu = <EtapeFonctionnalites {...commun} onSuivant={suivant} />;
  } else if (etape === 'formation') {
    contenu = <EtapeFormation {...commun} onSuivant={suivant} />;
  } else {
    contenu = (
      <EtapeFinal prenom={prenom} enCours={fermeture} onOuvrir={() => void terminer()} />
    );
  }

  return (
    <div className="onb-root priimo-pastel-wash relative flex h-full min-h-full w-full flex-1 flex-col overflow-hidden">
      <div key={`${etape}-${slideKey}`} className="onb-slide-enter flex min-h-0 flex-1 flex-col">
        {contenu}
      </div>

      {showRetour ? (
        <div className="shrink-0 px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-2 md:px-10 lg:px-14">
          <button
            type="button"
            onClick={precedent}
            className="inline-flex items-center gap-1.5 text-[13px] text-[#9A9A9A] transition hover:text-[#1A1A1A]"
          >
            <ArrowLeft size={15} strokeWidth={2.2} aria-hidden />
            Retour
          </button>
        </div>
      ) : null}
    </div>
  );
}
