'use client';

import { useEffect, useRef, useState } from 'react';
import type { NoteReviewPayload } from '@/lib/notes/build-review';

/** Nouveaux caractères avant de relire : un mot ou deux ne changent rien. */
const CROISSANCE_MIN = 24;
/** L'agent marque une pause : c'est le bon moment pour relire. */
const PAUSE_MS = 700;
/** Même sans pause, on relit au moins toutes les quatre secondes. */
const RELECTURE_MAX_MS = 4_000;

/**
 * Relit la dictée pendant qu'elle se fait et rend ce que Priimo en comprend.
 * Une seule lecture à la fois ; la dernière version du texte gagne toujours.
 */
export function useComprehensionEnDirect(
  texte: string,
  opts: { actif: boolean; banId?: string | null; recordedAt?: string | null },
): { review: NoteReviewPayload | null; enCours: boolean } {
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

  useEffect(() => {
    if (!opts.actif) return;
    const t = texte.trim();
    if (t.length < 16 || t.length - dernierLuRef.current.length < CROISSANCE_MIN) return;

    const lire = async (contenu: string) => {
      if (enVolRef.current) {
        attenteRef.current = contenu;
        return;
      }
      enVolRef.current = true;
      derniereLectureRef.current = Date.now();
      dernierLuRef.current = contenu;
      setEnCours(true);
      try {
        const res = await fetch('/api/dashboard/voice-notes/comprendre', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: contenu,
            banId: optsRef.current.banId ?? null,
            recordedAt: optsRef.current.recordedAt ?? null,
          }),
        });
        if (res.ok && optsRef.current.actif) setReview((await res.json()) as NoteReviewPayload);
      } catch {
        /* la lecture profonde repassera après la dictée */
      } finally {
        enVolRef.current = false;
        setEnCours(false);
        const suivant = attenteRef.current;
        attenteRef.current = null;
        if (suivant && suivant !== dernierLuRef.current && optsRef.current.actif) void lire(suivant);
      }
    };

    const depuis = Date.now() - derniereLectureRef.current;
    const delai = depuis >= RELECTURE_MAX_MS ? 0 : PAUSE_MS;
    const timer = window.setTimeout(() => void lire(t), delai);
    return () => window.clearTimeout(timer);
  }, [texte, opts.actif]);

  return { review, enCours };
}
