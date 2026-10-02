'use client';

import { useId, useRef, useState } from 'react';
import { StickyNote } from 'lucide-react';
import { ACCUEIL } from '@/lib/today/field';
import { PENSE_BETE_MAX } from '@/lib/activite/pense-bete';

const DEBOUNCE_MS = 450;
/** Une ligne au repos : le champ s'aligne sur le sélecteur de période. */
const LIGNE_PX = 20;
/** Six lignes en écrivant, ensuite on défile. */
const MAX_PX = 120;

/**
 * Le pense-bête de l'en-tête.
 *
 * Au repos, une seule ligne, à la hauteur du sélecteur de période : l'en-tête
 * reste net. Quand l'agent écrit, le post-it se déplie par-dessus la page,
 * sans pousser ce qui est dessous, et se replie quand il en sort.
 */
export default function PenseBete({
  initial,
  className = '',
}: {
  initial: string;
  className?: string;
}) {
  const [texte, setTexte] = useState(initial);
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dernierEnvoye = useRef(initial);
  const enVol = useRef<AbortController | null>(null);
  const champ = useRef<HTMLTextAreaElement | null>(null);
  const erreurId = useId();
  // Replié, on ne voit que la première ligne : on dit combien il en reste.
  const autresLignes = texte.trim() ? texte.trim().split('\n').filter((l) => l.trim()).length - 1 : 0;

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

  /** Déplié : à la hauteur du texte. Replié : une ligne. */
  const ajuster = (el: HTMLTextAreaElement | null, deplie: boolean) => {
    if (!el) return;
    if (!deplie) {
      el.style.height = `${LIGNE_PX}px`;
      el.style.overflowY = 'hidden';
      el.scrollTop = 0;
      return;
    }
    el.style.height = '0px';
    const suivante = Math.min(MAX_PX, Math.max(LIGNE_PX, el.scrollHeight));
    el.style.height = `${suivante}px`;
    el.style.overflowY = suivante >= MAX_PX ? 'auto' : 'hidden';
  };

  return (
    <div className={`relative h-9 min-w-0 ${className}`}>
      <div
        className={`absolute inset-x-0 top-0 flex items-start gap-2 rounded-clay px-3 py-2 transition-shadow duration-fluid-subtle ${
          ouvert ? 'z-30 shadow-clay ring-2 ring-accent/20' : 'shadow-clay-sm'
        }`}
        style={{ backgroundColor: ACCUEIL.creme }}
        onClick={() => champ.current?.focus()}
      >
        <StickyNote size={15} strokeWidth={2.2} aria-hidden className="mt-[2px] shrink-0 text-accent" />
        <textarea
          id="pense-bete"
          ref={(el) => {
            champ.current = el;
            ajuster(el, ouvert);
          }}
          value={texte}
          rows={1}
          maxLength={PENSE_BETE_MAX}
          placeholder="Pense-bête…"
          aria-label="Pense-bête"
          aria-describedby={erreur ? erreurId : undefined}
          aria-invalid={erreur ? true : undefined}
          className="block min-w-0 flex-1 resize-none bg-transparent text-[13.5px] leading-5 text-text-strong outline-none placeholder:text-text-muted"
          onFocus={(e) => {
            setOuvert(true);
            ajuster(e.currentTarget, true);
          }}
          onChange={(e) => {
            const suivant = e.currentTarget.value.slice(0, PENSE_BETE_MAX);
            setTexte(suivant);
            setErreur(null);
            planifier(suivant);
            ajuster(e.currentTarget, true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') e.currentTarget.blur();
          }}
          onBlur={(e) => {
            setOuvert(false);
            ajuster(e.currentTarget, false);
            if (timer.current) clearTimeout(timer.current);
            void sauver(texte);
          }}
        />
        {!ouvert && autresLignes > 0 ? (
          <span
            aria-hidden
            className="mt-px shrink-0 rounded-full bg-black/[0.06] px-1.5 text-[11px] font-semibold leading-[18px] text-text-muted"
          >
            +{autresLignes}
          </span>
        ) : null}
      </div>
      {erreur ? (
        <p
          id={erreurId}
          role="alert"
          className="absolute left-1 top-full mt-1 whitespace-nowrap text-[12px] font-medium text-[#B42318]"
        >
          {erreur}
        </p>
      ) : null}
    </div>
  );
}
