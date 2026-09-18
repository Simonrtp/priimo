'use client';

import { useId, useRef, useState } from 'react';
import { ACCUEIL } from '@/lib/today/field';
import { PENSE_BETE_MAX } from '@/lib/activite/pense-bete';

const DEBOUNCE_MS = 450;
/** Deux lignes au repos. */
const MIN_PX = 40;
/** Six lignes, ensuite on défile — la carte ne s’allonge plus. */
const MAX_PX = 120;

function ajuster(el: HTMLTextAreaElement) {
  el.style.height = '0px';
  const suivante = Math.min(MAX_PX, Math.max(MIN_PX, el.scrollHeight));
  el.style.height = `${suivante}px`;
  el.style.overflowY = suivante >= MAX_PX ? 'auto' : 'hidden';
}

export default function PenseBete({
  initial,
  className = '',
}: {
  initial: string;
  className?: string;
}) {
  const [texte, setTexte] = useState(initial);
  const [erreur, setErreur] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dernierEnvoye = useRef(initial);
  const enVol = useRef<AbortController | null>(null);
  const erreurId = useId();

  const sauver = async (valeur: string) => {
    if (valeur === dernierEnvoye.current) return;
    enVol.current?.abort();
    const ac = new AbortController();
    enVol.current = ac;
    try {
      const res = await fetch('/api/dashboard/pense-bete', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texte: valeur }),
        signal: ac.signal,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setErreur(body?.error ?? 'Enregistrement impossible');
        return;
      }
      dernierEnvoye.current = valeur;
      setErreur(null);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setErreur('Enregistrement impossible');
    }
  };

  const planifier = (valeur: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void sauver(valeur);
    }, DEBOUNCE_MS);
  };

  return (
    <div className={`min-w-0 ${className}`}>
      <div
        className="rounded-clay-lg px-3.5 py-2 shadow-clay-sm focus-within:ring-2 focus-within:ring-accent/20 sm:px-4"
        style={{ backgroundColor: ACCUEIL.creme }}
      >
        <label htmlFor="pense-bete" className="block text-[11px] font-semibold text-text-muted">
          Pense-bête
        </label>
        <textarea
          id="pense-bete"
          ref={(el) => {
            if (el) ajuster(el);
          }}
          value={texte}
          rows={1}
          maxLength={PENSE_BETE_MAX}
          placeholder="note, essai, gribouillis"
          aria-describedby={erreur ? erreurId : undefined}
          aria-invalid={erreur ? true : undefined}
          className="mt-1 block w-full resize-none overflow-hidden bg-transparent text-[13.5px] leading-snug text-text-strong outline-none [field-sizing:content] max-h-[7.5rem] placeholder:text-text-muted"
          onInput={(e) => ajuster(e.currentTarget)}
          onChange={(e) => {
            const suivant = e.currentTarget.value.slice(0, PENSE_BETE_MAX);
            setTexte(suivant);
            setErreur(null);
            planifier(suivant);
            ajuster(e.currentTarget);
          }}
          onBlur={() => {
            if (timer.current) clearTimeout(timer.current);
            void sauver(texte);
          }}
        />
      </div>
      {erreur ? (
        <p id={erreurId} role="alert" className="mt-1 px-1 text-[12.5px] font-medium text-[#B42318]">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}
