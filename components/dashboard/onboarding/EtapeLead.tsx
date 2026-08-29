'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { notifyError } from '@/lib/notify';
import { celebratePipelineVictory } from '@/lib/pipeline/victories';
import type { OnboardingLeadPropose } from '@/lib/queries/agent-onboarding';
import OnboardingShell from './OnboardingShell';

/**
 * Étape 1 — il prend son premier lead.
 *
 * Rien n'est simulé : le clic assigne réellement l'adresse à l'agent et
 * l'entre dans son pipeline (le déclencheur en base pose taken_at et écrit
 * l'événement de transition). Elle sera toujours là quand l'onboarding se
 * refermera.
 */
export default function EtapeLead({
  rang,
  total,
  leads,
  stageEntreeId,
  profileId,
  onSuivant,
}: {
  rang: number;
  total: number;
  leads: readonly OnboardingLeadPropose[];
  /** Étape d'entrée du pipeline de l'agence. Sans elle, on ne peut rien prendre. */
  stageEntreeId: string | null;
  profileId: string;
  onSuivant: () => void;
}) {
  const router = useRouter();
  const [prisId, setPrisId] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  async function prendre(lead: OnboardingLeadPropose) {
    if (prisId || enCours) return;
    if (!stageEntreeId) {
      notifyError("Le pipeline de l'agence n'est pas encore configuré");
      return;
    }
    setEnCours(lead.id);
    try {
      const res = await fetch(`/api/dashboard/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo: profileId, stageId: stageEntreeId }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        notifyError(data.error ?? "L'adresse n'a pas pu être prise");
        return;
      }
      setPrisId(lead.id);
      celebratePipelineVictory('premiere_prise');
      router.refresh();
    } catch {
      notifyError("L'adresse n'a pas pu être prise");
    } finally {
      setEnCours(null);
    }
  }

  const pris = leads.find((l) => l.id === prisId) ?? null;
  const restants = leads.filter((l) => l.id !== prisId);

  return (
    <OnboardingShell
      rang={rang}
      total={total}
      titre="Prenez votre première adresse"
      phrase={
        pris
          ? 'Les adresses que personne ne prend restent dans la liste. C’est votre directeur qui verra la différence.'
          : 'Prenez-en une. C’est comme ça qu’une adresse entre dans votre pipeline.'
      }
      action={
        pris ? (
          <button
            type="button"
            onClick={onSuivant}
            className="rounded-lg bg-[#6366F1] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:brightness-[0.97]"
          >
            Continuer
          </button>
        ) : null
      }
    >
      <div className="h-full min-h-0 overflow-y-auto overscroll-contain md:overflow-visible">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,240px)]">
        <ul className="flex min-w-0 flex-col gap-2">
          {restants.map((lead) => (
            <li key={lead.id}>
              <button
                type="button"
                disabled={Boolean(prisId) || enCours != null}
                onClick={() => void prendre(lead)}
                className="flex w-full items-center justify-between gap-3 rounded-clay border border-black/10 bg-white px-4 py-3 text-left transition hover:border-[#6366F1] hover:bg-[#6366F1]/[0.06] disabled:opacity-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14.5px] font-medium text-ink">
                    {lead.address}
                  </span>
                  <span className="mt-0.5 block truncate text-[12.5px] text-text-muted">
                    {[
                      lead.mainSignalLabel,
                      lead.propertyType,
                      lead.surfaceM2 ? `${lead.surfaceM2} m²` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Adresse à travailler'}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="tabular-nums text-[13px] font-semibold text-text-muted">
                    {lead.score}
                  </span>
                  <span className="rounded-lg border border-black/10 px-2.5 py-1 text-[12.5px] font-medium text-ink">
                    {enCours === lead.id ? 'Prise…' : 'Prendre'}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {restants.length === 0 && !pris ? (
            <li className="text-[13.5px] text-text-muted">
              Aucune adresse libre en ce moment sur votre secteur.
            </li>
          ) : null}
        </ul>

        {/* La colonne « Pris » n'existe qu'à partir du moment où il a pris. */}
        {pris ? (
          <>
            <div className="hidden w-px bg-black/[0.08] md:block" aria-hidden />
            <div className="min-w-0">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-text-subtle">
                Pris
              </p>
              <div
                className="mt-2 rounded-clay border border-[#6366F1]/40 bg-[#6366F1]/[0.06] px-3.5 py-3"
                style={{ animation: 'fadeIn 0.35s ease-out' }}
              >
                <p className="flex items-start gap-2 text-[14px] font-medium text-ink">
                  <MapPin size={15} className="mt-0.5 shrink-0 text-[#6366F1]" aria-hidden />
                  <span className="min-w-0 break-words">{pris.address}</span>
                </p>
                <p className="mt-1 text-[12.5px] text-text-muted">Assignée à vous</p>
              </div>
            </div>
          </>
          ) : null}
        </div>
      </div>
    </OnboardingShell>
  );
}
