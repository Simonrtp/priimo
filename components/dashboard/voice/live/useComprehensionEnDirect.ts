'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { NoteReviewPayload } from '@/lib/notes/build-review';

/** Nouveaux caractères avant de relire : un mot ou deux ne changent rien. */
const CROISSANCE_MIN = 20;
/** L'agent marque une pause : c'est le bon moment pour relire. */
const PAUSE_MS = 500;
/** Même sans pause, on relit au moins toutes les trois secondes. */
const RELECTURE_MAX_MS = 3_000;

/**
 * Relit la dictée pendant qu'elle se fait et rend ce que Priimo en comprend.
 * Une seule lecture à la fois ; la dernière version du texte gagne toujours.
 * `relire` force une lecture immédiate (fin de dictée, texte corrigé).
 */
export function useComprehensionEnDirect(
  texte: string,
  opts: { actif: boolean; banId?: string | null; recordedAt?: string | null },
): {
  review: NoteReviewPayload | null;
  enCours: boolean;
  relire: (texte: string) => void;
} {
  const [review, setReview] = useState<NoteReviewPayload | null>(null);
  const [enCours, setEnCours] = useState(false);
  const dernierLuRef = useRef('');
  const enVolRef = useRef(false);
  const attenteRef = useRef<string | null>(null);
  const derniereLectureRef = useRef(0);
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });

  // Une seule fonction de lecture pour toute la vie du composant : elle ne
  // touche qu'à des références et à des setters stables.
  const lireRef = useRef<(contenu: string) => Promise<void>>(async () => undefined);
  useEffect(() => {
    lireRef.current = lire;
    async function lire(contenu: string): Promise<void> {
      const t = contenu.trim();
      if (t.length < 12 || t === dernierLuRef.current) return;
      if (enVolRef.current) {
        attenteRef.current = t;
        return;
      }
      enVolRef.current = true;
      derniereLectureRef.current = Date.now();
      dernierLuRef.current = t;
      setEnCours(true);
      try {
        const res = await fetch('/api/dashboard/voice-notes/comprendre', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: t,
            banId: optsRef.current.banId ?? null,
            recordedAt: optsRef.current.recordedAt ?? null,
          }),
        });
        if (res.ok && optsRef.current.actif) setReview((await res.json()) as NoteReviewPayload);
      } catch {
        /* la lecture suivante repassera */
      } finally {
        enVolRef.current = false;
        const suivant = attenteRef.current;
        attenteRef.current = null;
        if (suivant && suivant !== dernierLuRef.current && optsRef.current.actif) void lire(suivant);
        else setEnCours(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!opts.actif) return;
    const t = texte.trim();
    if (t.length < 16 || Math.abs(t.length - dernierLuRef.current.length) < CROISSANCE_MIN) return;
    const depuis = Date.now() - derniereLectureRef.current;
    const delai = depuis >= RELECTURE_MAX_MS ? 0 : PAUSE_MS;
    const timer = window.setTimeout(() => void lireRef.current(t), delai);
    return () => window.clearTimeout(timer);
  }, [texte, opts.actif]);

  const relire = useCallback((contenu: string) => void lireRef.current(contenu), []);

  return { review, enCours, relire };
}
