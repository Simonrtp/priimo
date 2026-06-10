'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Lead, MlFeedback } from '@/types/lead';
import { ML_FEEDBACK_OPTIONS } from '@/lib/lead-meta';
import Select from '@/components/ui/Select';

interface LeadMlFeedbackFieldsProps {
  lead: Lead;
  onUpdateLead: (id: string, patch: Partial<Lead>) => Promise<void>;
  selectTriggerClassName: string;
  reasonFontSize?: number;
}

export default function LeadMlFeedbackFields({
  lead,
  onUpdateLead,
  selectTriggerClassName,
  reasonFontSize = 13,
}: LeadMlFeedbackFieldsProps) {
  const [reason, setReason] = useState(lead.mlFeedbackReason ?? '');
  const reasonDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setReason(lead.mlFeedbackReason ?? '');
  }, [lead.id, lead.mlFeedbackReason]);

  const handleResult = useCallback(
    async (value: string) => {
      const next: MlFeedback = value === '' ? null : (value as NonNullable<MlFeedback>);
      try {
        await onUpdateLead(lead.id, {
          mlFeedback: next,
          mlFeedbackReason: next ? reason.trim() || null : null,
          mlFeedbackAt: next ? new Date().toISOString() : null,
        });
        if (!next) setReason('');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erreur lors de l\'enregistrement du résultat.');
      }
    },
    [lead.id, onUpdateLead, reason],
  );

  const persistReason = useCallback(
    async (raw: string) => {
      if (!lead.mlFeedback) return;
      const trimmed = raw.trim() || null;
      if (trimmed === (lead.mlFeedbackReason?.trim() || null)) return;
      try {
        await onUpdateLead(lead.id, {
          mlFeedbackReason: trimmed,
          mlFeedbackAt: new Date().toISOString(),
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erreur lors de l\'enregistrement de la note.');
        setReason(lead.mlFeedbackReason ?? '');
      }
    },
    [lead.id, lead.mlFeedback, lead.mlFeedbackReason, onUpdateLead],
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
      <p className="text-mute" style={{ fontSize: 11.5, lineHeight: 1.45 }}>
        Aidez Priimo à s&apos;améliorer : indiquez ce qu&apos;a donné ce lead.
      </p>
      <div>
        <p className="mb-1.5 text-mute" style={{ fontSize: 11 }}>
          Résultat
        </p>
        <div onClick={(e) => e.stopPropagation()}>
          <Select
            aria-label="Résultat du lead"
            value={lead.mlFeedback ?? ''}
            triggerClassName={selectTriggerClassName}
            options={[
              { value: '', label: 'Aucun résultat' },
              ...ML_FEEDBACK_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
            ]}
            onChange={handleResult}
          />
        </div>
      </div>
      {lead.mlFeedback && (
        <div>
          <p className="mb-1.5 text-mute" style={{ fontSize: 11 }}>
            Raison / note <span className="text-mute/70">(optionnel)</span>
          </p>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            onBlur={() => void persistReason(reason)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Ex. refus prix, déjà en mandat ailleurs, mauvais numéro…"
            className="placeholder-mute/60 w-full resize-y rounded-xl border border-black/8 px-4 py-2.5 text-ink focus:border-accent/40 focus:outline-none"
            style={{ fontSize: reasonFontSize, lineHeight: 1.5 }}
          />
        </div>
      )}
    </div>
  );
}
