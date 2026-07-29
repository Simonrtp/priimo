'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { Check, ChevronDown, Copy, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { Lead } from '@/types/lead';
import {
  approachCanalLabel,
  listAvailableCanaux,
  type ApproachCanal,
  type ApproachVariante,
} from '@/lib/script-approche';
import { DetailSection, DetailSectionLabel } from './LeadDetailSection';

const COMPANY_PHONE_NOTICE =
  "L'échange doit porter sur la société et le bien qu'elle détient.";

const AI_THINKING_MS = 1100;

async function copyText(text: string, successLabel: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successLabel);
  } catch {
    toast.error('Impossible de copier');
  }
}

function CopyButton({
  text,
  label = 'Copier',
  successLabel = 'Texte copié',
}: {
  text: string;
  label?: string;
  successLabel?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(t);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void copyText(text, successLabel).then(() => setCopied(true));
      }}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium text-mute transition-colors hover:bg-black/[0.04] hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
      style={{ fontSize: 12 }}
    >
      {copied ? (
        <Check size={13} strokeWidth={2.2} aria-hidden />
      ) : (
        <Copy size={13} strokeWidth={2.2} aria-hidden />
      )}
      {copied ? 'Copié' : label}
    </button>
  );
}

/** Bouton : l'IA « réfléchit », puis affiche le raisonnement (angle). */
function AiReasoningButton({ angle }: { angle: string | null }) {
  const panelId = useId();
  const [phase, setPhase] = useState<'idle' | 'thinking' | 'ready'>('idle');

  useEffect(() => {
    setPhase('idle');
  }, [angle]);

  useEffect(() => {
    if (phase !== 'thinking') return;
    const t = window.setTimeout(() => setPhase('ready'), AI_THINKING_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  const reasoning =
    angle?.trim() ||
    "L'IA a croisé les signaux de ce lead pour proposer une accroche adaptée au canal. Adaptez le ton à votre agence.";

  return (
    <div className="mt-2.5">
      {phase === 'idle' && (
        <button
          type="button"
          aria-expanded={false}
          aria-controls={panelId}
          onClick={(e) => {
            e.stopPropagation();
            setPhase('thinking');
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#3D5A80]/20 bg-[rgba(61,90,128,0.06)] px-2.5 py-1.5 font-medium text-[#3D5A80] transition-colors hover:bg-[rgba(61,90,128,0.1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3D5A80]/25"
          style={{ fontSize: 12 }}
        >
          <Sparkles size={13} strokeWidth={2.2} aria-hidden />
          Voir le raisonnement IA
        </button>
      )}

      {phase === 'thinking' && (
        <p
          id={panelId}
          className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[#3D5A80]"
          style={{ fontSize: 12.5 }}
          aria-live="polite"
        >
          <span className="inline-flex gap-1" aria-hidden>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#3D5A80]" />
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#3D5A80]"
              style={{ animationDelay: '120ms' }}
            />
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#3D5A80]"
              style={{ animationDelay: '240ms' }}
            />
          </span>
          L&apos;IA réfléchit…
        </p>
      )}

      {phase === 'ready' && (
        <div
          id={panelId}
          className="rounded-xl border border-[#3D5A80]/15 bg-[rgba(61,90,128,0.05)] px-3 py-2.5"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-2">
            <p
              className="font-semibold uppercase tracking-[0.06em] text-[#3D5A80]"
              style={{ fontSize: 10.5 }}
            >
              Raisonnement IA
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPhase('idle');
              }}
              className="font-medium text-mute hover:text-ink focus:outline-none focus-visible:underline"
              style={{ fontSize: 11.5 }}
            >
              Masquer
            </button>
          </div>
          <p className="mt-1.5 italic text-ink/80" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
            <span className="not-italic font-medium text-mute">Pour vous :</span> {reasoning}
          </p>
        </div>
      )}
    </div>
  );
}

function ObjectionsBlock({ objections }: { objections: ApproachVariante['objections'] }) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  if (objections.length === 0) return null;

  return (
    <div className="mt-4 border-t border-black/[0.05] pt-3">
      <button
        type="button"
        id={`${panelId}-trigger`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex w-full items-center gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
      >
        <span className="min-w-0 flex-1 font-medium text-ink" style={{ fontSize: 13 }}>
          Si on vous répond…
        </span>
        <ChevronDown
          size={15}
          strokeWidth={2.2}
          className={`shrink-0 text-mute transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={`${panelId}-trigger`}
        className="grid transition-[grid-template-rows,opacity] duration-200 ease-out"
        style={{
          gridTemplateRows: open ? '1fr' : '0fr',
          opacity: open ? 1 : 0,
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <ul className={`space-y-3 ${open ? 'mt-3' : ''}`}>
            {objections.map((item, index) => (
              <li
                key={`${item.objection}-${index}`}
                className="rounded-xl border border-black/[0.06] bg-white px-3 py-2.5"
              >
                {item.objection && (
                  <p className="font-semibold text-ink" style={{ fontSize: 13, lineHeight: 1.4 }}>
                    {item.objection}
                  </p>
                )}
                {item.reponse && (
                  <p
                    className={`text-mute ${item.objection ? 'mt-1' : ''}`}
                    style={{ fontSize: 12.5, lineHeight: 1.5 }}
                  >
                    {item.reponse}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function VarianteContent({
  canal,
  variante,
  showCompanyNotice,
}: {
  canal: ApproachCanal;
  variante: ApproachVariante;
  showCompanyNotice: boolean;
}) {
  return (
    <div className="mt-3">
      <AiReasoningButton angle={variante.angle} />

      {variante.ouverture && (
        <div className="relative mt-3 rounded-xl border border-[#E8743C]/15 bg-[#FFF7F0] px-3.5 py-3">
          <div className="mb-1.5 flex justify-end">
            <CopyButton
              text={variante.ouverture}
              label={canal === 'courrier' ? 'Copier la lettre' : 'Copier'}
              successLabel={canal === 'courrier' ? 'Lettre copiée' : 'Texte copié'}
            />
          </div>
          <p className="whitespace-pre-wrap text-ink" style={{ fontSize: 14, lineHeight: 1.55 }}>
            {variante.ouverture}
          </p>
        </div>
      )}

      {showCompanyNotice && (
        <p
          className="mt-2.5 rounded-xl px-3 py-2 text-pretty"
          style={{
            fontSize: 12,
            lineHeight: 1.45,
            backgroundColor: '#FFF7F0',
            color: '#3D5A80',
          }}
        >
          {COMPANY_PHONE_NOTICE}
        </p>
      )}

      {variante.question && (
        <p className="mt-3 text-ink" style={{ fontSize: 13, lineHeight: 1.5 }}>
          <span className="font-medium text-mute">Puis :</span> {variante.question}
        </p>
      )}

      <ObjectionsBlock objections={variante.objections} />

      {variante.sortie && (
        <p className="mt-4 text-mute" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
          <span className="font-medium">Pour conclure :</span> {variante.sortie}
        </p>
      )}
    </div>
  );
}

/**
 * Section « Votre approche » — scripts terrain / courrier / téléphone.
 * N'affiche rien si script_approche est vide ou invalide.
 */
export default function LeadApproachScript({ lead }: { lead: Lead }) {
  const script = lead.scriptApproche;
  const canaux = useMemo(() => (script ? listAvailableCanaux(script) : []), [script]);
  const canauxKey = canaux.join(',');
  const [active, setActive] = useState<ApproachCanal | null>(null);

  useEffect(() => {
    setActive(canaux[0] ?? null);
  }, [lead.id, canauxKey, canaux]);

  if (!script || canaux.length === 0 || !active) return null;

  const variante = script[active];
  if (!variante) return null;

  const hasNeighborPhones = lead.contactsImmeuble.some((c) => Boolean(c.phone?.trim()));
  const showCompanyNotice =
    active === 'telephone' &&
    (lead.ownerType === 'entreprise' || hasNeighborPhones);

  return (
    <DetailSection>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <DetailSectionLabel className="mb-0">Votre approche</DetailSectionLabel>
        <span
          className="inline-flex items-center gap-1 rounded-md bg-[#3D5A80]/10 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-[#3D5A80]"
          style={{ fontSize: 10 }}
        >
          <Sparkles size={10} strokeWidth={2.4} aria-hidden />
          Généré par IA
        </span>
      </div>
      <p className="mb-3 text-mute" style={{ fontSize: 12, lineHeight: 1.45 }}>
        Suggestion IA à partir des signaux du lead — à adapter à votre style.
      </p>

      {canaux.length > 1 && (
        <div
          role="tablist"
          aria-label="Canal d'approche"
          className="mb-1 flex gap-1 rounded-lg bg-black/[0.04] p-0.5"
        >
          {canaux.map((canal) => {
            const selected = canal === active;
            return (
              <button
                key={canal}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={(e) => {
                  e.stopPropagation();
                  setActive(canal);
                }}
                className={`min-h-8 flex-1 rounded-md px-2.5 py-1.5 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 ${
                  selected ? 'bg-white text-ink shadow-sm' : 'text-mute hover:text-ink'
                }`}
                style={{ fontSize: 12.5 }}
              >
                {approachCanalLabel(canal)}
              </button>
            );
          })}
        </div>
      )}

      {canaux.length === 1 && (
        <p className="mb-1 text-mute" style={{ fontSize: 12 }}>
          {approachCanalLabel(active)}
        </p>
      )}

      <VarianteContent
        key={`${lead.id}-${active}`}
        canal={active}
        variante={variante}
        showCompanyNotice={showCompanyNotice}
      />
    </DetailSection>
  );
}
