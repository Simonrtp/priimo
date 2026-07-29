'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { Lead, LeadStatus } from '@/types/lead';
import { STATUS_META, STATUS_ORDER, STATUS_TO_ML_FEEDBACK } from '@/lib/lead-meta';
import Select from '@/components/ui/Select';

interface LeadStatusControlProps {
  lead: Lead;
  onUpdateLead: (id: string, patch: Partial<Lead>) => Promise<void>;
  selectTriggerClassName: string;
  reasonFontSize?: number;
  /** Ancre visite guidée — cadrée sur le sélecteur statut uniquement. */
  tourAnchor?: string;
  /** Libellé du champ (défaut : Statut). */
  label?: string;
  /** Classes du libellé. */
  labelClassName?: string;
  /** Taille du libellé. */
  labelFontSize?: number;
  /** Emplacement optionnel à droite du sélecteur (ex. Assigné). */
  trailing?: ReactNode;
  /** Empile Statut / Assigné (mobile). */
  stackTrailing?: boolean;
}

export default function LeadStatusControl({
  lead,
  onUpdateLead,
  selectTriggerClassName,
  reasonFontSize = 13,
  tourAnchor,
  label = 'Statut',
  labelClassName = 'mb-1.5 text-mute',
  labelFontSize = 11,
  trailing,
  stackTrailing = false,
}: LeadStatusControlProps) {
  const [reason, setReason] = useState(lead.mlFeedbackReason ?? '');
  const reasonDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setReason(lead.mlFeedbackReason ?? '');
  }, [lead.id, lead.mlFeedbackReason]);

  // Le feedback ML découle directement du statut choisi.
  const mlFeedback = STATUS_TO_ML_FEEDBACK[lead.status];
  const trainsModel = mlFeedback != null;

  const handleStatus = useCallback(
    async (next: LeadStatus) => {
      const nextMl = STATUS_TO_ML_FEEDBACK[next];
      try {
        await onUpdateLead(lead.id, {
          status: next,
          mlFeedback: nextMl,
          mlFeedbackReason: nextMl ? reason.trim() || null : null,
          mlFeedbackAt: nextMl ? new Date().toISOString() : null,
        });
        if (!nextMl) setReason('');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erreur lors du changement de statut.');
      }
    },
    [lead.id, onUpdateLead, reason],
  );

  const persistReason = useCallback(
    async (raw: string) => {
      if (!trainsModel) return;
      const trimmed = raw.trim() || null;
      if (trimmed === (lead.mlFeedbackReason?.trim() || null)) return;
      try {
        await onUpdateLead(lead.id, {
          mlFeedbackReason: trimmed,
          mlFeedbackAt: new Date().toISOString(),
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur lors de l'enregistrement de la note.");
        setReason(lead.mlFeedbackReason ?? '');
      }
    },
    [trainsModel, lead.mlFeedbackReason, lead.id, onUpdateLead],
  );

  const onReasonChange = useCallback(
    (value: string) => {
      setReason(value);
      if (reasonDebounceRef.current) clearTimeout(reasonDebounceRef.current);
      reasonDebounceRef.current = setTimeout(() => {
        void persistReason(value);
      }, 600);
    },
    [persistReason],
  );

  useEffect(() => {
    return () => {
      if (reasonDebounceRef.current) clearTimeout(reasonDebounceRef.current);
    };
  }, []);

  return (
    <div className="space-y-3">
      <div
        className={
          trailing
            ? stackTrailing
              ? 'flex flex-col gap-2.5'
              : 'grid grid-cols-2 gap-2.5'
            : undefined
        }
      >
        <div data-tour={tourAnchor} className="min-w-0">
          <p className={labelClassName} style={{ fontSize: labelFontSize }}>
            {label}
          </p>
          <div onClick={(e) => e.stopPropagation()}>
            <Select
              aria-label="Statut du lead"
              value={lead.status}
              triggerClassName={selectTriggerClassName}
              options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_META[s].label }))}
              onChange={(v) => handleStatus(v as LeadStatus)}
            />
          </div>
        </div>
        {trailing ? <div className="min-w-0">{trailing}</div> : null}
      </div>

      {trainsModel && (
        <>
          <p className="text-mute/80" style={{ fontSize: 11, lineHeight: 1.45 }}>
            Ce statut aide Priimo à s&apos;améliorer. Précisez au besoin ce qu&apos;a donné ce lead.
          </p>
          <div>
            <p className={labelClassName} style={{ fontSize: labelFontSize }}>
              Raison / note <span className="text-mute/70">(optionnel)</span>
            </p>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              onBlur={() => void persistReason(reason)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Ex. refus prix, déjà en mandat ailleurs, mauvais numéro…"
              className="placeholder-mute/60 w-full resize-y rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-ink/90 focus:border-black/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/10"
              style={{ fontSize: reasonFontSize, lineHeight: 1.5 }}
            />
          </div>
        </>
      )}
    </div>
  );
}
