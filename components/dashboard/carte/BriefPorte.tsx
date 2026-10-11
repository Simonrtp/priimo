'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Square, Volume2 } from 'lucide-react';
import { useUser } from '@/lib/hooks/useUser';
import {
  LIBELLES_BRIEF,
  collecterBrief,
  texteAEcouter,
  type BlocFiche,
  type Brief,
} from '@/lib/carte/brief-porte';
import type { ParcelleFiche } from '@/lib/carte/parcelle';

/** Un tap sur une ligne du brief : le bloc replié correspondant s'ouvre. */
export const EVENEMENT_BLOC_FICHE = 'priimo:fiche-bloc';

const ECLAT_MS = 1600;

function prefereMoinsDeMouvement(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Descend jusqu'au bloc source et le met en évidence un instant. */
function allerAuBloc(depuis: HTMLElement, bloc: BlocFiche) {
  const racine = depuis.closest('[data-fiche-racine]');
  if (!racine) return;
  window.dispatchEvent(new CustomEvent<BlocFiche>(EVENEMENT_BLOC_FICHE, { detail: bloc }));
  // Le repli s'ouvre au rendu suivant : on vise le bloc une fois en place.
  window.requestAnimationFrame(() => {
    const cible =
      racine.querySelector<HTMLElement>(`[data-fiche-bloc="${bloc}"]`) ??
      racine.querySelector<HTMLElement>('[data-fiche-bloc="entete"]');
    if (!cible) return;
    cible.scrollIntoView({ block: 'start', behavior: prefereMoinsDeMouvement() ? 'auto' : 'smooth' });
    cible.classList.remove('fiche-bloc-eclat');
    void cible.offsetWidth;
    cible.classList.add('fiche-bloc-eclat');
    window.setTimeout(() => cible.classList.remove('fiche-bloc-eclat'), ECLAT_MS);
  });
}

function voixFrancaise(): SpeechSynthesisVoice | null {
  const voix = window.speechSynthesis.getVoices();
  return voix.find((v) => v.lang === 'fr-FR') ?? voix.find((v) => v.lang.toLowerCase().startsWith('fr')) ?? null;
}

function useLecture(texte: string | null) {
  const [disponible, setDisponible] = useState(false);
  const [enLecture, setEnLecture] = useState(false);

  useEffect(() => {
    setDisponible(typeof window !== 'undefined' && 'speechSynthesis' in window);
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  // Un autre brief (autre parcelle, nouvelle note) : la lecture en cours s'arrête.
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setEnLecture(false);
  }, [texte]);

  function basculer() {
    if (!texte || !disponible) return;
    const synth = window.speechSynthesis;
    if (enLecture) {
      synth.cancel();
      setEnLecture(false);
      return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(texte);
    u.lang = 'fr-FR';
    const voix = voixFrancaise();
    if (voix) u.voice = voix;
    u.rate = 1;
    u.onend = () => setEnLecture(false);
    u.onerror = () => setEnLecture(false);
    setEnLecture(true);
    synth.speak(u);
  }

  return { disponible, enLecture, basculer };
}

export function SqueletteBrief() {
  return (
    <div className="rounded-[22px] bg-bg-subtle px-4 pb-4 pt-3.5" aria-hidden>
      <div className="flex min-h-11 items-center justify-between">
        <div className="squelette h-2.5 w-24 rounded-full" />
        <div className="squelette h-9 w-[6.5rem] rounded-full" />
      </div>
      <div className="mt-1 flex flex-col gap-3.5">
        {[0.9, 0.75, 0.85, 0.7, 1, 0.8].map((w, i) => (
          <div key={i} className="flex gap-3">
            <div className="squelette mt-1 h-2.5 w-[4.75rem] shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <div className="squelette h-3.5 rounded-full" style={{ width: `${w * 100}%` }} />
              {i === 4 ? <div className="squelette mt-2 h-3.5 w-3/5 rounded-full" /> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * « Avant de sonner » : la fiche en six lignes, en tête du volet. Chaque
 * ligne renvoie au bloc d'où elle vient ; rien n'y figure que la fiche ne
 * montre déjà à cet agent.
 */
export default function BriefPorte({ fiche, noteTick }: { fiche: ParcelleFiche; noteTick: number }) {
  const { profile } = useUser();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [echec, setEchec] = useState(false);
  const premiere = useRef(true);

  useEffect(() => {
    const ac = new AbortController();
    // Après une note, l'ancien brief reste lisible le temps de la relecture.
    if (premiere.current) setBrief(null);
    premiere.current = false;
    setEchec(false);
    void fetch(`/api/carte/parcelle/${encodeURIComponent(fiche.parcelleId)}/brief?n=${noteTick}`, {
      signal: ac.signal,
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('brief');
        const data = (await res.json()) as Brief;
        if (!Array.isArray(data.lignes) || data.lignes.length === 0) throw new Error('brief');
        setBrief(data);
      })
      .catch(() => {
        if (!ac.signal.aborted) setEchec(true);
      });
    return () => ac.abort();
  }, [fiche.parcelleId, noteTick]);

  // Sans réponse du serveur : la même fiche, en lignes brutes.
  const repli = useMemo<Brief | null>(() => {
    if (!echec || !profile) return null;
    return { lignes: collecterBrief(fiche, null, { id: profile.id, role: profile.role }).lignes, redige: false };
  }, [echec, fiche, profile]);

  const affiche = brief ?? repli;
  const lecture = useLecture(affiche ? texteAEcouter(affiche.lignes) : null);

  if (!affiche) {
    return (
      <div role="status" aria-label="Préparation du brief">
        <SqueletteBrief />
      </div>
    );
  }

  return (
    <section aria-labelledby="brief-porte-titre" className="rounded-[22px] bg-bg-subtle px-4 pb-3 pt-2">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h3
          id="brief-porte-titre"
          className="text-[12px] font-semibold uppercase tracking-[0.06em] text-text-subtle"
        >
          Avant de sonner
        </h3>
        {lecture.disponible ? (
          <button
            type="button"
            onClick={lecture.basculer}
            aria-pressed={lecture.enLecture}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-3.5 text-[14px] font-semibold text-text-strong shadow-[0_1px_2px_rgba(26,42,86,0.08)] transition-colors hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {lecture.enLecture ? (
              <Square size={13} strokeWidth={2.4} aria-hidden className="fill-current" />
            ) : (
              <Volume2 size={16} strokeWidth={2.2} aria-hidden />
            )}
            {lecture.enLecture ? 'Arrêter' : 'Écouter'}
          </button>
        ) : null}
      </div>
      <ul className="flex flex-col">
        {affiche.lignes.map((l) => {
          const aDire = l.cle === 'ouverture';
          return (
            <li key={l.cle} className="border-t border-black/[0.05] first:border-t-0">
              <button
                type="button"
                onClick={(e) => allerAuBloc(e.currentTarget, l.bloc)}
                className="-mx-2 flex min-h-11 w-[calc(100%+1rem)] items-start gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
              >
                <span className="w-[4.75rem] shrink-0 pt-[3px] text-[12.5px] font-semibold leading-tight text-text-subtle">
                  {LIBELLES_BRIEF[l.cle]}
                </span>
                <span
                  className={`min-w-0 flex-1 text-pretty text-[15.5px] leading-snug ${
                    l.manque ? 'text-text-muted' : aDire ? 'font-semibold text-text-strong' : 'text-text-strong'
                  }`}
                >
                  {l.texte}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
