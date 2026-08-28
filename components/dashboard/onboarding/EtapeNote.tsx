'use client';

import { useEffect, useState } from 'react';
import { Mic, NotebookPen } from 'lucide-react';
import { useVoiceCapture } from '@/components/dashboard/voice/VoiceCaptureProvider';
import { onNoteCreated } from '@/lib/notes/note-created-event';
import { micPermissionState } from '@/lib/voice/mic';
import OnboardingShell from './OnboardingShell';

/**
 * Étape 2 — il dicte sa première note.
 *
 * La note est enregistrée pour de bon, avec sa transcription et ses
 * rattachements. Le micro peut être refusé ou absent : dans ce cas la saisie
 * clavier prend le relais. L'onboarding ne se bloque jamais sur une
 * permission navigateur.
 */
export default function EtapeNote({
  rang,
  total,
  onSuivant,
  onPasser,
}: {
  rang: number;
  total: number;
  onSuivant: () => void;
  onPasser: () => void;
}) {
  const { openCapture, openCompose } = useVoiceCapture();
  const [enregistree, setEnregistree] = useState(false);
  const [micRefuse, setMicRefuse] = useState(false);

  useEffect(() => onNoteCreated(() => setEnregistree(true)), []);

  useEffect(() => {
    void micPermissionState().then((etat) => {
      if (etat === 'denied') setMicRefuse(true);
    });
  }, []);

  async function dicter() {
    const etat = await micPermissionState();
    if (etat === 'denied') {
      setMicRefuse(true);
      openCompose();
      return;
    }
    openCapture();
  }

  return (
    <OnboardingShell
      rang={rang}
      total={total}
      titre={enregistree ? 'Votre note est enregistrée' : 'Dictez votre première note'}
      phrase={
        enregistree
          ? 'Vous venez de faire ce que la plupart des agents font le soir à 18h30, en huit secondes.'
          : micRefuse
            ? 'Le micro est refusé par votre navigateur. Écrivez plutôt — le traitement est le même.'
            : 'Appuyez et dites quelque chose. N’importe quoi.'
      }
      onPasser={onPasser}
      action={
        enregistree ? (
          <button
            type="button"
            onClick={onSuivant}
            className="rounded-lg bg-accent px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-accent-dark"
          >
            Continuer
          </button>
        ) : null
      }
    >
      <div className="rounded-clay border border-black/[0.06] bg-surface p-5 shadow-clay-sm">
        <div className="flex flex-wrap items-center gap-3">
          {!micRefuse ? (
            <button
              type="button"
              onClick={() => void dicter()}
              className="inline-flex items-center gap-2.5 rounded-clay bg-accent px-5 py-3 text-[15px] font-semibold text-white transition hover:bg-accent-dark"
            >
              <Mic size={18} strokeWidth={2} aria-hidden />
              Dicter
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => openCompose()}
            className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-4 py-2.5 text-[13.5px] font-medium text-ink transition hover:bg-black/[0.03]"
          >
            <NotebookPen size={15} aria-hidden />
            Écrire au clavier
          </button>
        </div>

        <p className="mt-4 text-[13px] leading-relaxed text-text-muted">
          Ce que vous dites est transcrit, puis rattaché tout seul à l’adresse, au contact ou au
          bien concerné. Vous relisez, vous validez.
        </p>
      </div>
    </OnboardingShell>
  );
}
