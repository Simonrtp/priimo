'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import OnboardingShell, {
  ONB_ACCENT,
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

const selectClass =
  'w-full appearance-none rounded-xl border border-black/10 bg-white px-3.5 py-3 text-[15px] text-[#1A1A1A] outline-none focus:border-[var(--onb-accent)] focus:ring-2 focus:ring-[color:var(--onb-accent)]/20';

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
      titre="On aime souhaiter les anniversaires."
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
      <div className="mx-auto w-full max-w-sm">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-[#6B6B6B]">Jour</span>
            <select
              className={selectClass}
              style={{ '--onb-accent': ONB_ACCENT } as CSSProperties}
              value={day === '' ? '' : String(day)}
              onChange={(e) => setDay(e.target.value ? Number(e.target.value) : '')}
              aria-label="Jour d’anniversaire"
            >
              <option value="">—</option>
              {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-[#6B6B6B]">Mois</span>
            <select
              className={selectClass}
              style={{ '--onb-accent': ONB_ACCENT } as CSSProperties}
              value={month === '' ? '' : String(month)}
              onChange={(e) => {
                const m = e.target.value ? Number(e.target.value) : '';
                setMonth(m);
                if (typeof day === 'number' && typeof m === 'number' && day > joursDansMois(m)) {
                  setDay('');
                }
              }}
              aria-label="Mois d’anniversaire"
            >
              <option value="">—</option>
              {MOIS.map((label, i) => (
                <option key={label} value={i + 1}>
                  {label}
                </option>
              ))}
            </select>
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
              className="mt-0.5 size-4 rounded border-black/20 accent-[#6366F1]"
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
              className="mt-0.5 size-4 rounded border-black/20 accent-[#6366F1] disabled:opacity-40"
            />
            <span>Afficher mon anniversaire à mon équipe le jour J</span>
          </label>
        </div>
      </div>
    </OnboardingShell>
  );
}
