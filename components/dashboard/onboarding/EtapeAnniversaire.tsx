'use client';

import { useMemo, useState } from 'react';
import Select from '@/components/ui/Select';
import OnboardingShell, {
  OnboardingGhostLink,
  OnboardingPrimaryButton,
} from './OnboardingShell';

const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

function joursDansMois(mois: number): number {
  // Année non bissextile : février = 28 — l’année n’est pas collectée.
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mois - 1] ?? 31;
}

const triggerClass =
  'flex w-full items-center justify-between gap-2 rounded-xl border border-black/10 bg-white px-3.5 py-3 text-left text-[15px] text-[#1A1A1A] outline-none transition hover:border-black/15 focus-visible:border-[#E8743C]/50 focus-visible:ring-2 focus-visible:ring-[#E8743C]/20 disabled:cursor-not-allowed disabled:opacity-50 md:rounded-2xl md:px-4 md:py-3.5 md:text-[16px]';

/**
 * Écran 3 — anniversaire (jour + mois), deux consentements distincts.
 */
export default function EtapeAnniversaire({
  rang,
  total,
  onSuivant,
  onSkip,
}: {
  rang: number;
  total: number;
  onSuivant: (data: {
    month: number;
    day: number;
    visibleTeam: boolean;
  }) => void;
  onSkip: () => void;
}) {
  const [month, setMonth] = useState<number | ''>('');
  const [day, setDay] = useState<number | ''>('');
  const [storeOk, setStoreOk] = useState(false);
  const [visibleTeam, setVisibleTeam] = useState(false);
  const [saving, setSaving] = useState(false);

  const maxDay = useMemo(() => (month === '' ? 31 : joursDansMois(month)), [month]);

  const dayOptions = useMemo(
    () => [
      { value: '', label: '—' },
      ...Array.from({ length: maxDay }, (_, i) => ({
        value: String(i + 1),
        label: String(i + 1),
      })),
    ],
    [maxDay],
  );

  const monthOptions = useMemo(
    () => [
      { value: '', label: '—' },
      ...MOIS.map((label, i) => ({ value: String(i + 1), label })),
    ],
    [],
  );

  const canSubmit =
    storeOk && typeof month === 'number' && typeof day === 'number' && day >= 1 && day <= maxDay;

  async function enregistrer() {
    if (!canSubmit || typeof month !== 'number' || typeof day !== 'number') return;
    setSaving(true);
    try {
      onSuivant({ month, day, visibleTeam });
    } finally {
      setSaving(false);
    }
  }

  return (
    <OnboardingShell
      rang={rang}
      total={total}
      titre="On aime souhaiter les anniversaires !"
      phrase="Le jour venu, votre équipe le verra sur son accueil. Rien d’autre n’en sera fait."
      action={
        <>
          <OnboardingPrimaryButton
            onClick={() => void enregistrer()}
            disabled={!canSubmit || saving}
          >
            Continuer
          </OnboardingPrimaryButton>
          <OnboardingGhostLink onClick={onSkip}>Je préfère ne pas</OnboardingGhostLink>
        </>
      }
    >
      <div className="w-full max-w-md md:max-w-2xl">
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-[#6B6B6B]">Jour</span>
            <Select
              value={day === '' ? '' : String(day)}
              onChange={(v) => setDay(v ? Number(v) : '')}
              options={dayOptions}
              aria-label="Jour d’anniversaire"
              triggerClassName={triggerClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-[#6B6B6B]">Mois</span>
            <Select
              value={month === '' ? '' : String(month)}
              onChange={(v) => {
                const m = v ? Number(v) : '';
                setMonth(m);
                if (typeof day === 'number' && typeof m === 'number' && day > joursDansMois(m)) {
                  setDay('');
                }
              }}
              options={monthOptions}
              aria-label="Mois d’anniversaire"
              triggerClassName={triggerClass}
            />
          </label>
        </div>

        <p className="mt-3 text-[12px] leading-relaxed text-[#8A8A8A]">
          Donnée hébergée en France, modifiable ou supprimable à tout moment depuis vos
          paramètres.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <label className="flex items-start gap-3 text-[13.5px] leading-snug text-[#1A1A1A]">
            <input
              type="checkbox"
              checked={storeOk}
              onChange={(e) => {
                setStoreOk(e.target.checked);
                if (!e.target.checked) setVisibleTeam(false);
              }}
              className="mt-0.5 size-4 rounded border-black/20 accent-[#E8743C]"
            />
            <span>Enregistrer ma date d’anniversaire</span>
          </label>
          <label
            className={`flex items-start gap-3 text-[13.5px] leading-snug ${
              storeOk ? 'text-[#1A1A1A]' : 'text-[#A3A3A3]'
            }`}
          >
            <input
              type="checkbox"
              checked={visibleTeam}
              disabled={!storeOk}
              onChange={(e) => setVisibleTeam(e.target.checked)}
              className="mt-0.5 size-4 rounded border-black/20 accent-[#E8743C] disabled:opacity-40"
            />
            <span>Afficher mon anniversaire à mon équipe le jour J</span>
          </label>
        </div>
      </div>
    </OnboardingShell>
  );
}
