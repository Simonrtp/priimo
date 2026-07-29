'use client';

import { useEffect, useId, useState } from 'react';
import { Check, ChevronDown, Copy, RefreshCw, Sparkles } from 'lucide-react';
import type { Lead } from '@/types/lead';
import { notifyError, notifySuccess } from '@/lib/notify';
import { extractApproachIntro, emphasizeApproachFacts, stripApproachMarkup } from '@/lib/script-approche';
import { DetailSection, DetailSectionLabel } from './LeadDetailSection';

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(stripApproachMarkup(text));
    notifySuccess('Texte copié', { id: 'approach-copy' });
  } catch {
    notifyError('Impossible de copier');
  }
}

function ApproachText({ text }: { text: string }) {
  const parts = emphasizeApproachFacts(text);
  return (
    <p className="whitespace-pre-wrap break-words text-ink" style={{ fontSize: 14, lineHeight: 1.6 }}>
      {parts.map((part, i) =>
        part.bold ? (
          <strong key={i} className="font-bold text-ink">
            {part.text}
          </strong>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  );
}

function MistralThinking({ label = 'Mistral rédige le prompt…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-1" aria-live="polite" role="status">
      <span className="inline-flex gap-1.5" aria-hidden>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink" />
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink"
          style={{ animationDelay: '300ms' }}
        />
      </span>
      <p className="font-medium text-ink" style={{ fontSize: 13 }}>
        {label}
      </p>
    </div>
  );
}

/**
 * Section « Votre approche » — volet déroulant (même motif que les autres sections).
 */
export default function LeadApproachScript({
  lead,
  onScriptChange,
}: {
  lead: Lead;
  onScriptChange?: (script: NonNullable<Lead['scriptApproche']>) => void;
}) {
  const panelId = useId();
  const storedIntro = lead.scriptApproche ? extractApproachIntro(lead.scriptApproche) : null;
  const [localIntro, setLocalIntro] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const intro = localIntro ?? storedIntro;
  const needsGeneration = !intro;

  useEffect(() => {
    setOpen(false);
    setLocalIntro(null);
    setError(null);
    setGenerating(false);
    setCopied(false);
  }, [lead.id]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(t);
  }, [copied]);

  const applyScript = (script: NonNullable<Lead['scriptApproche']>) => {
    const text = extractApproachIntro(script);
    if (!text) return false;
    setLocalIntro(text);
    onScriptChange?.(script);
    setOpen(true);
    return true;
  };

  const generate = async (force: boolean) => {
    if (generating) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/leads/${lead.id}/approach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      const data = (await res.json()) as {
        error?: string;
        script?: NonNullable<Lead['scriptApproche']>;
      };
      if (!res.ok || !data.script) {
        setError(data.error ?? 'La génération a échoué. Réessayez.');
        return;
      }
      if (!applyScript(data.script)) {
        setError('La génération a échoué. Réessayez.');
        return;
      }
      notifySuccess(force ? 'Prompt mis à jour' : 'Prompt prêt', {
        id: `approach-${lead.id}`,
      });
    } catch {
      setError('Impossible de joindre le serveur. Réessayez.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <DetailSection>
      <button
        type="button"
        id={`${panelId}-trigger`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex w-full items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-1.5">
            <DetailSectionLabel className="mb-0">Votre approche</DetailSectionLabel>
            <span
              className="inline-flex items-center gap-1 font-semibold uppercase tracking-[0.06em] text-violet-600"
              style={{ fontSize: 12 }}
            >
              <Sparkles size={12} strokeWidth={2.4} className="text-violet-500" aria-hidden />
              IA
            </span>
          </div>
        </div>
        <ChevronDown
          size={16}
          strokeWidth={2.2}
          className={`shrink-0 text-mute transition-transform duration-200 ease-out motion-reduce:transition-none ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={`${panelId}-trigger`}
        className="grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none"
        style={{
          gridTemplateRows: open ? '1fr' : '0fr',
          opacity: open ? 1 : 0,
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className={open ? 'mt-3 space-y-3' : ''}>
            {generating && (
              <MistralThinking
                label={intro ? 'Mistral refait le prompt…' : 'Mistral rédige le prompt…'}
              />
            )}

            {!generating && intro && (
              <div className="rounded-2xl border-2 border-ink bg-white px-3.5 py-3">
                <div className="mb-2 flex justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void copyText(intro).then(() => setCopied(true));
                    }}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-mute transition-colors hover:bg-black/[0.04] hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                    style={{ fontSize: 12.5 }}
                  >
                    {copied ? (
                      <Check size={14} strokeWidth={2.2} aria-hidden />
                    ) : (
                      <Copy size={14} strokeWidth={2.2} aria-hidden />
                    )}
                    {copied ? 'Copié' : 'Copier'}
                  </button>
                </div>
                <ApproachText text={intro} />
              </div>
            )}

            {!generating && needsGeneration && (
              <button
                type="button"
                disabled={generating}
                onClick={(e) => {
                  e.stopPropagation();
                  void generate(false);
                }}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 font-semibold text-white transition-colors hover:bg-black disabled:cursor-wait disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
                style={{ fontSize: 14 }}
              >
                <Sparkles size={16} strokeWidth={2.2} aria-hidden />
                Préparer l’approche
              </button>
            )}

            {!generating && intro && (
              <button
                type="button"
                disabled={generating}
                onClick={(e) => {
                  e.stopPropagation();
                  void generate(true);
                }}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 py-2 font-semibold text-white transition-[filter,transform] hover:brightness-110 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/45"
                style={{
                  fontSize: 13,
                  background: 'linear-gradient(90deg, #4A7AFF 0%, #907CF7 55%, #D866B0 100%)',
                }}
              >
                <RefreshCw size={15} strokeWidth={2.2} aria-hidden />
                Refaire
              </button>
            )}

            {error && (
              <p className="text-[#C25E2C]" style={{ fontSize: 12.5 }} role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </DetailSection>
  );
}
