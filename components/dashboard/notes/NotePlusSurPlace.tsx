'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Mic, NotebookPen, Plus, X } from 'lucide-react';
import { useVoiceCapture } from '@/components/dashboard/voice/VoiceCaptureProvider';
import { useOutsideDismiss } from '@/lib/hooks/useOutsideDismiss';
import { armPointerShield } from '@/lib/ui/pointer-guard';

function banIdUtile(id: string | undefined): string | undefined {
  const v = (id ?? '').trim();
  if (!v || v.startsWith('gps:')) return undefined;
  return v;
}

/**
 * En-tête « Notes terrain » + plus : écrire ou dicter, déjà rattaché à l’adresse.
 * Le menu s’ouvre dans le flux, sous le titre — le panneau carte le coupe sinon.
 */
export default function NotePlusSurPlace({
  adresse,
  banId,
}: {
  adresse: string;
  banId?: string;
}) {
  const { openCapture, openCompose } = useVoiceCapture();
  const [ouvert, setOuvert] = useState(false);
  const racine = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const fermer = useCallback(() => setOuvert(false), []);
  useOutsideDismiss(ouvert, fermer, racine);

  useEffect(() => {
    if (!ouvert) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOuvert(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ouvert]);

  const ctx = {
    adresse,
    banId: banIdUtile(banId),
    resterSurPage: true as const,
  };

  return (
    <div ref={racine} className="mb-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold uppercase text-text-subtle" style={{ fontSize: 11 }}>
          Notes terrain
        </p>
        <button
          type="button"
          onClick={() => setOuvert((v) => !v)}
          aria-label={ouvert ? 'Fermer le menu de note' : 'Ajouter une note'}
          aria-expanded={ouvert}
          aria-haspopup="menu"
          aria-controls={ouvert ? menuId : undefined}
          className="flex size-9 items-center justify-center rounded-full bg-accent text-white shadow-clay-sm transition-colors duration-fluid-subtle ease-in-out hover:bg-accent-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {ouvert ? (
            <X size={16} strokeWidth={2.4} aria-hidden />
          ) : (
            <Plus size={18} strokeWidth={2.4} aria-hidden />
          )}
        </button>
      </div>
      {ouvert ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Ajouter une note"
          className="mt-2 flex flex-col overflow-hidden rounded-clay border border-black/[0.08] bg-surface py-1 shadow-clay-sm"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOuvert(false);
              armPointerShield();
              openCompose(ctx);
            }}
            className="flex min-h-11 w-full items-center gap-2.5 px-3 py-2 text-left text-[13.5px] font-medium text-text transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <NotebookPen size={16} strokeWidth={2} className="text-accent" aria-hidden />
            Écrire
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOuvert(false);
              armPointerShield();
              openCapture(ctx);
            }}
            className="flex min-h-11 w-full items-center gap-2.5 px-3 py-2 text-left text-[13.5px] font-medium text-text transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Mic size={16} strokeWidth={2} className="text-accent" aria-hidden />
            Dicter
          </button>
        </div>
      ) : null}
    </div>
  );
}
