'use client';

import { useState } from 'react';
import { Check, Shield } from 'lucide-react';
import { notifyError, notifySuccess } from '@/lib/notify';
import type { OnboardingLeadPropose } from '@/lib/queries/agent-onboarding';
import { isOnboardingShowcaseLead } from '@/lib/onboarding/lead-showcase';
import ScoreRing from '@/components/dashboard/ScoreRing';
import OnboardingShell, { OnboardingPrimaryButton } from './OnboardingShell';

/**
 * Étape « pourquoi frapper ici ».
 *
 * La valeur perçue n'est pas le clic pipeline : c'est de voir, sur une vraie
 * adresse du secteur, ce que Priimo sait déjà (signaux, hors portails).
 * L'ajout au suivi n'est que la conclusion naturelle.
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
  stageEntreeId: string | null;
  profileId: string;
  onSuivant: () => void;
}) {
  const [ajoute, setAjoute] = useState<OnboardingLeadPropose | null>(null);
  const [enCours, setEnCours] = useState(false);

  const courant = leads[0] ?? null;

  async function ajouterAuSuivi() {
    if (!courant || ajoute || enCours) return;

    if (isOnboardingShowcaseLead(courant.id)) {
      setAjoute(courant);
      notifySuccess('Dans votre suivi. Vous pourrez y revenir depuis Prospection.', {
        id: 'onboarding-suivi',
        duration: 3600,
      });
      return;
    }

    if (!stageEntreeId) {
      notifyError("Le pipeline de l'agence n'est pas encore configuré");
      return;
    }
    setEnCours(true);
    try {
      const res = await fetch(`/api/dashboard/leads/${courant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo: profileId, stageId: stageEntreeId }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        notifyError(data.error ?? "L'adresse n'a pas pu être ajoutée");
        return;
      }
      setAjoute(courant);
      notifySuccess('Dans votre suivi. Vous pourrez y revenir depuis Prospection.', {
        id: 'onboarding-suivi',
        duration: 3600,
      });
    } catch {
      notifyError("L'adresse n'a pas pu être ajoutée");
    } finally {
      setEnCours(false);
    }
  }

  if (ajoute) {
    return (
      <OnboardingShell
        rang={rang}
        total={total}
        compact
        titre="Vous savez déjà pourquoi"
        phrase="C’est ça Priimo : devant la porte, les faits sont là. L’adresse est dans votre suivi Prospection."
        action={
          <OnboardingPrimaryButton onClick={onSuivant}>Continuer</OnboardingPrimaryButton>
        }
      >
        <div
          className="rounded-clay border border-[#E8743C]/35 bg-[#E8743C]/[0.07] px-4 py-4"
          style={{ animation: 'fadeIn 0.35s ease-out' }}
        >
          <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-[#E8743C]">
            <Check size={14} strokeWidth={2.5} aria-hidden />
            Dans votre suivi
          </p>
          <p className="mt-2 text-[15px] font-medium text-ink">{ajoute.address}</p>
          {ajoute.accroche ? (
            <p className="mt-1 text-[13px] text-text-muted">{ajoute.accroche}</p>
          ) : null}
        </div>
      </OnboardingShell>
    );
  }

  if (!courant) {
    return (
      <OnboardingShell
        rang={rang}
        total={total}
        compact
        titre="Pas d’adresse libre pour l’instant"
        phrase="Dès qu’une opportunité sort sur votre secteur, elle apparaîtra ici avec ses signaux."
        action={
          <OnboardingPrimaryButton onClick={onSuivant}>Continuer</OnboardingPrimaryButton>
        }
      />
    );
  }

  const faits =
    courant.faits.length > 0
      ? courant.faits
      : courant.mainSignalLabel
        ? [courant.mainSignalLabel]
        : [];

  return (
    <OnboardingShell
      rang={rang}
      total={total}
      compact
      titre="Pourquoi frapper ici ?"
      phrase="Une vraie adresse de votre secteur. Voici ce qu’on sait déjà — avant même d’appeler."
      action={
        <OnboardingPrimaryButton onClick={() => void ajouterAuSuivi()} disabled={enCours}>
          {enCours ? 'Ajout…' : 'Ajouter à mon suivi'}
        </OnboardingPrimaryButton>
      }
    >
      <article
        className="rounded-clay border border-black/[0.08] bg-white px-4 py-4 shadow-clay-sm md:px-5 md:py-5"
        key={courant.id}
        style={{ animation: 'fadeIn 0.28s ease-out' }}
      >
        <div className="flex items-start gap-3">
          <ScoreRing score={courant.score} size={44} />
          <div className="min-w-0 flex-1">
            <h2 className="text-pretty text-[16px] font-semibold leading-snug text-ink md:text-[17px]">
              {courant.address}
            </h2>
            {courant.accroche ? (
              <p className="mt-1 text-[13.5px] leading-snug text-text-muted">{courant.accroche}</p>
            ) : (
              <p className="mt-1 text-[13.5px] text-text-muted">
                {[courant.propertyType, courant.surfaceM2 ? `${courant.surfaceM2} m²` : null]
                  .filter(Boolean)
                  .join(' · ') || 'Bien à qualifier'}
              </p>
            )}
          </div>
        </div>

        {courant.horsMarche ? (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-[#EEF2F7] px-3 py-2 text-[12.5px] font-medium text-[#3D5A80]">
            <Shield size={14} className="shrink-0" aria-hidden />
            Absent des portails de vente
          </p>
        ) : null}

        {faits.length > 0 ? (
          <div className="mt-4 border-t border-black/[0.06] pt-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8A8A8A]">
              Ce qu’on sait déjà
            </p>
            <ul className="mt-2 space-y-1.5">
              {faits.map((fait) => (
                <li
                  key={fait}
                  className="flex items-start gap-2 text-[13.5px] leading-snug text-ink"
                >
                  <span className="mt-[6px] size-1.5 shrink-0 rounded-full bg-[#E8743C]" aria-hidden />
                  <span className="min-w-0">{fait}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-4 text-[13px] leading-relaxed text-text-muted">
            Score {courant.score} — une opportunité détectée sur votre secteur.
          </p>
        )}
      </article>
    </OnboardingShell>
  );
}
