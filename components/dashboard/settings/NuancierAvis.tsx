'use client';

import { NUANCIER_ACCENT, NUANCIER_ACCENT2 } from '@/lib/rapport/couleurs';

function Nuancier({
  id,
  label,
  aide,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  aide: string;
  value: string;
  options: readonly { hex: string; label: string }[];
  onChange: (hex: string) => void;
}) {
  const actuel = value.toUpperCase();
  const connu = options.some((c) => c.hex.toUpperCase() === actuel);
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 font-medium text-gray-700">{label}</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby={id}>
        <span id={id} className="sr-only">
          {label}
        </span>
        {options.map((c) => {
          const selected = c.hex.toUpperCase() === actuel;
          return (
            <button
              key={c.hex}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={c.label}
              title={c.label}
              onClick={() => onChange(c.hex.toUpperCase())}
              className="relative size-10 rounded-lg border border-black/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              style={{ backgroundColor: c.hex }}
            >
              {selected ? (
                <span className="absolute inset-0 rounded-lg ring-2 ring-[#0A0D11] ring-offset-2" aria-hidden />
              ) : null}
            </button>
          );
        })}
        {!connu && /^#[0-9A-Fa-f]{6}$/.test(actuel) ? (
          <button
            type="button"
            role="radio"
            aria-checked
            aria-label="Couleur actuelle"
            className="relative size-10 rounded-lg border border-black/10"
            style={{ backgroundColor: actuel }}
          >
            <span className="absolute inset-0 rounded-lg ring-2 ring-[#0A0D11] ring-offset-2" aria-hidden />
          </button>
        ) : null}
      </div>
      <p className="mt-1.5 text-pretty text-[12.5px] text-mute">{aide}</p>
    </fieldset>
  );
}

export default function NuancierAvis({
  accent,
  accent2,
  onAccent,
  onAccent2,
}: {
  accent: string;
  accent2: string;
  onAccent: (hex: string) => void;
  onAccent2: (hex: string) => void;
}) {
  return (
    <div className="grid gap-5">
      <div className="overflow-hidden rounded-lg border border-black/10 bg-white">
        <div className="flex items-center justify-between px-4 pt-3">
          <p className="flex gap-2 text-[15px] uppercase tracking-wide">
            <span className="font-bold" style={{ color: accent }}>
              Avis de
            </span>
            <span className="font-normal" style={{ color: accent2 }}>
              valeur
            </span>
          </p>
        </div>
        <div className="mt-2 flex items-center px-4">
          <span className="h-1 w-20 shrink-0" style={{ backgroundColor: accent }} aria-hidden />
          <span className="h-px flex-1 opacity-35" style={{ backgroundColor: accent }} aria-hidden />
        </div>
        <div
          className="mt-3 flex h-8 items-center px-4 text-[11px] text-white"
          style={{ backgroundColor: accent2 }}
        >
          Pied de page
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Nuancier
          id="avis-accent"
          label="Couleur principale"
          aide="Titres forts, bandes et curseur d’estimation."
          value={accent}
          options={NUANCIER_ACCENT}
          onChange={onAccent}
        />
        <Nuancier
          id="avis-accent-2"
          label="Couleur secondaire"
          aide="Titres clairs, pied de page et bande « prochaine étape »."
          value={accent2}
          options={NUANCIER_ACCENT2}
          onChange={onAccent2}
        />
      </div>
    </div>
  );
}
