'use client';

import { useEffect, useState } from 'react';
import { Pause, Sparkles, Volume2 } from 'lucide-react';
import type { Memoire } from '@/lib/notes/memoire';
import styles from '@/components/dashboard/voice/live/dictee.module.css';

/** Voix française du téléphone : gratuite, hors ligne sur la plupart des appareils. */
function voixFrancaise(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voix = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('fr'));
  return voix.find((v) => /premium|enhanced|natural|amélioré/i.test(v.name)) ?? voix[0] ?? null;
}

/**
 * « Ce que l'agence sait » : toutes les notes sur une personne ou un
 * immeuble, relues en quelques lignes. Un bouton les lit à voix haute — le
 * briefing de la voiture, avant de sonner.
 */
export default function MemoireAgence({
  contactId,
  banId,
  titre = 'Ce que l’agence sait',
}: {
  contactId?: string;
  banId?: string;
  titre?: string;
}) {
  const [etat, setEtat] = useState<'repos' | 'lecture' | 'pret' | 'vide' | 'erreur'>('repos');
  const [memoire, setMemoire] = useState<Memoire | null>(null);
  const [parle, setParle] = useState(false);

  // Changer de fiche remonte le composant (clé posée par le parent) ; en
  // partant, on coupe la voix pour ne pas lire la fiche d'avant.
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    };
  }, []);

  async function resumer() {
    setEtat('lecture');
    try {
      const res = await fetch('/api/dashboard/notes/memoire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, banId }),
      });
      const data = (await res.json()) as { memoire?: Memoire | null; error?: string };
      if (!res.ok) throw new Error(data.error);
      if (!data.memoire) {
        setEtat('vide');
        return;
      }
      setMemoire(data.memoire);
      setEtat('pret');
    } catch {
      setEtat('erreur');
    }
  }

  function ecouter() {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    if (!synth || !memoire) return;
    if (parle) {
      synth.cancel();
      setParle(false);
      return;
    }
    const texte = [memoire.briefing, memoire.aSuivre ? `À suivre : ${memoire.aSuivre}` : null]
      .filter(Boolean)
      .join(' ');
    const phrase = new SpeechSynthesisUtterance(texte);
    phrase.lang = 'fr-FR';
    phrase.rate = 1.04;
    const voix = voixFrancaise();
    if (voix) phrase.voice = voix;
    phrase.onend = () => setParle(false);
    phrase.onerror = () => setParle(false);
    synth.cancel();
    synth.speak(phrase);
    setParle(true);
  }

  const peutParler = typeof window !== 'undefined' && 'speechSynthesis' in window;

  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">{titre}</h3>

      {etat === 'repos' || etat === 'erreur' ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void resumer()}
            className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-primary-50 px-3 text-[13px] font-semibold text-primary-600 transition-colors hover:bg-primary-100"
          >
            <Sparkles size={15} strokeWidth={2} aria-hidden />
            Résumer les notes
          </button>
          {etat === 'erreur' ? (
            <span className="text-[12.5px] text-text-muted">Le résumé n’a pas abouti. Réessayez.</span>
          ) : null}
        </div>
      ) : null}

      {etat === 'lecture' ? (
        <div className={`rounded-2xl border border-black/[0.06] bg-surface px-4 py-3.5 ${styles.lectureReflet}`} aria-busy="true">
          <p className="text-[13px] text-text-muted">Priimo relit toutes les notes…</p>
          <div className="mt-2 flex flex-col gap-1.5" aria-hidden>
            <span className="h-2.5 w-4/5 rounded-full bg-black/[0.05]" />
            <span className="h-2.5 w-3/5 rounded-full bg-black/[0.05]" />
            <span className="h-2.5 w-2/3 rounded-full bg-black/[0.05]" />
          </div>
        </div>
      ) : null}

      {etat === 'vide' ? (
        <p className="text-[13.5px] text-text-subtle">Aucune note encore. Dictez la prochaine visite : elle viendra ici.</p>
      ) : null}

      {etat === 'pret' && memoire ? (
        <div className={`rounded-2xl border border-black/[0.06] bg-surface px-4 py-3.5 shadow-clay-sm ${styles.carteEntree}`}>
          <ul className="flex flex-col gap-1.5">
            {memoire.points.map((p) => (
              <li key={p} className="flex gap-2 text-[13.5px] leading-snug text-text">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary-400" aria-hidden />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          {memoire.aSuivre ? (
            <p className="mt-2.5 rounded-xl bg-primary-50 px-3 py-2 text-[13px] font-medium text-primary-700">
              À suivre : {memoire.aSuivre}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12px] text-text-subtle">
              D’après {memoire.sources} note{memoire.sources > 1 ? 's' : ''} et échange{memoire.sources > 1 ? 's' : ''}
            </span>
            {peutParler ? (
              <button
                type="button"
                onClick={ecouter}
                aria-pressed={parle}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-black/10 px-3 text-[13px] font-semibold text-text-strong transition-colors hover:bg-black/[0.03]"
              >
                {parle ? <Pause size={15} strokeWidth={2} aria-hidden /> : <Volume2 size={15} strokeWidth={2} aria-hidden />}
                {parle ? 'Arrêter' : 'Écouter le briefing'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
