'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, Mic, NotebookPen } from 'lucide-react';
import OnboardingShell, { OnboardingPrimaryButton } from './OnboardingShell';

type Phase = 'intro' | 'dictating' | 'typing' | 'preview' | 'done';

const DEMO_TRANSCRIPT =
  'Mme Bernard au 4e, T3 d’environ 72 m². Intéressée pour une estimation — rappeler jeudi matin.';

const DEMO_INSIGHTS = [
  { label: 'Adresse', value: '12 rue des Maraîchers 75020 Paris' },
  { label: 'Contact', value: 'Mme Bernard' },
  { label: 'Relance', value: 'Jeudi matin' },
  { label: 'Bien', value: 'T3 · 72 m² · 4e étage' },
] as const;

/**
 * Étape note — démo sans enregistrement réel.
 * L’agent voit le flux dictée → extraction → validation, sans API ni clôture en base.
 */
export default function EtapeNote({
  rang,
  total,
  onSuivant,
}: {
  rang: number;
  total: number;
  onSuivant: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [texte, setTexte] = useState(DEMO_TRANSCRIPT);

  useEffect(() => {
    if (phase !== 'dictating') return;
    const t = window.setTimeout(() => setPhase('preview'), 2200);
    return () => window.clearTimeout(t);
  }, [phase]);

  const titre =
    phase === 'done'
      ? 'Votre note est enregistrée'
      : phase === 'preview'
        ? 'Voici ce que Priimo en déduit'
        : 'Dictez ou écrivez une note';

  const phrase =
    phase === 'done'
      ? 'En conditions réelles, la note serait rangée et rattachée tout seul. Ici, c’était un exemple — rien n’a été enregistré.'
      : phase === 'preview'
        ? 'Priimo transcrit, extrait l’adresse, le contact et la relance. Vous relisez, vous validez — sans ressaisir le soir.'
        : phase === 'dictating'
          ? 'Écoute en cours… Priimo transcrit en direct.'
          : phase === 'typing'
            ? 'Saisissez ou modifiez l’exemple, puis voyez le résultat.'
            : 'Hyper utile en prospection physique : plus besoin d’un bout de papier. Essayez avec cet exemple.';

  return (
    <OnboardingShell
      rang={rang}
      total={total}
      titre={titre}
      phrase={phrase}
      action={
        phase === 'done' ? (
          <OnboardingPrimaryButton onClick={onSuivant}>Continuer</OnboardingPrimaryButton>
        ) : phase === 'preview' ? (
          <OnboardingPrimaryButton onClick={() => setPhase('done')}>Valider l’exemple</OnboardingPrimaryButton>
        ) : null
      }
    >
      {phase === 'intro' ? (
        <div className="rounded-clay border border-black/[0.06] bg-surface p-5 shadow-clay-sm">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#8A8A8A]">
            Exemple — rien n’est enregistré
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setPhase('dictating')}
              className="inline-flex items-center gap-2.5 rounded-clay bg-[#E8743C] px-5 py-3 text-[15px] font-semibold text-white transition hover:brightness-[0.97]"
            >
              <Mic size={18} strokeWidth={2} aria-hidden />
              Dicter
            </button>
            <button
              type="button"
              onClick={() => setPhase('typing')}
              className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-4 py-2.5 text-[13.5px] font-medium text-ink transition hover:bg-black/[0.03]"
            >
              <NotebookPen size={15} aria-hidden />
              Écrire au clavier
            </button>
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-text-muted">
            Ce que vous dites (ou écrivez) est transcrit, puis rattaché tout seul à l’adresse, au
            contact ou au bien.
          </p>
        </div>
      ) : null}

      {phase === 'dictating' ? (
        <div
          className="flex flex-col items-center justify-center rounded-clay border border-black/[0.06] bg-surface px-6 py-10 shadow-clay-sm"
          aria-live="polite"
        >
          <span className="relative flex size-16 items-center justify-center rounded-full bg-[#E8743C]/15">
            <Mic size={28} className="text-[#E8743C]" aria-hidden />
            <span className="absolute inset-0 animate-ping rounded-full bg-[#E8743C]/20 motion-reduce:animate-none" />
          </span>
          <p className="mt-4 text-[14px] font-medium text-ink">Dictée en cours…</p>
          <Loader2 size={18} className="mt-2 animate-spin text-[#8A8A8A] motion-reduce:animate-none" aria-hidden />
        </div>
      ) : null}

      {phase === 'typing' ? (
        <div className="rounded-clay border border-black/[0.06] bg-surface p-5 shadow-clay-sm">
          <label htmlFor="onb-note-demo" className="sr-only">
            Exemple de note
          </label>
          <textarea
            id="onb-note-demo"
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            rows={4}
            className="w-full resize-none rounded-xl border border-black/10 bg-white px-3.5 py-3 text-[14px] leading-relaxed text-ink outline-none focus:border-[#E8743C]/50 focus:ring-2 focus:ring-[#E8743C]/15"
          />
          <button
            type="button"
            onClick={() => setPhase('preview')}
            disabled={texte.trim().length < 8}
            className="mt-3 w-full rounded-xl bg-[#E8743C] px-4 py-3 text-[14px] font-semibold text-white transition hover:brightness-[0.97] disabled:opacity-40"
          >
            Voir le résultat
          </button>
        </div>
      ) : null}

      {phase === 'preview' || phase === 'done' ? (
        <div
          className="rounded-clay border border-black/[0.06] bg-surface p-5 shadow-clay-sm"
          style={phase === 'done' ? { animation: 'fadeIn 0.35s ease-out' } : undefined}
        >
          {phase === 'done' ? (
            <p className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-[#E8743C]">
              <Check size={14} strokeWidth={2.5} aria-hidden />
              Exemple validé
            </p>
          ) : (
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#8A8A8A]">
              Aperçu — démo
            </p>
          )}

          <blockquote className="text-pretty text-[15px] leading-relaxed text-ink md:text-[16px]">
            « {texte.trim() || DEMO_TRANSCRIPT} »
          </blockquote>

          <ul className="mt-4 space-y-2 border-t border-black/[0.06] pt-4">
            {DEMO_INSIGHTS.map(({ label, value }) => (
              <li key={label} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13.5px]">
                <span className="font-semibold text-ink">{label}</span>
                <span className="text-text-muted">{value}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </OnboardingShell>
  );
}
