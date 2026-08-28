'use client';

import {
  DISPERSION_MESSAGE,
  FIABILITE_LABEL,
  formatEuro,
  niveauFiabilite,
  phraseComparables,
  phraseImmeuble,
  type ResultatSummary,
} from '@/lib/estimation/resultat';

/**
 * Hiérarchie de l'écran de résultat.
 *
 * La valeur centrale est le titre, avec le prix au m² à côté d'elle ; la
 * fourchette passe en dessous, en plus petit. Mettre l'incertitude en premier
 * était un contresens : c'est la valeur qui intéresse le vendeur.
 *
 * Quand la dispersion du secteur est trop forte, la fourchette disparaît au
 * profit d'une phrase honnête. Un chiffre mou ne convainc personne ; « une
 * visite est nécessaire » est un meilleur argument, et un rendez-vous.
 */

const NIVEAU_COULEUR: Record<string, string> = {
  elevee: '#0F7A4F',
  correcte: '#8A6100',
  limitee: '#8A2F2F',
};

const NIVEAU_FOND: Record<string, string> = {
  elevee: '#E7F4EE',
  correcte: '#FBF2DE',
  limitee: '#F8E9E9',
};

export function PastilleFiabilite({ score }: { score: number }) {
  const niveau = niveauFiabilite(score);
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold"
      style={{ color: NIVEAU_COULEUR[niveau], backgroundColor: NIVEAU_FOND[niveau] }}
    >
      {FIABILITE_LABEL[niveau]}
    </span>
  );
}

export default function ValeurCentrale({
  value,
  low,
  high,
  pricePerM2,
  dispersionElevee,
  reliability,
  summary,
}: {
  value: number | null;
  low: number | null;
  high: number | null;
  pricePerM2: number | null;
  dispersionElevee: boolean;
  reliability: number;
  summary: ResultatSummary;
}) {
  if (value == null) {
    return (
      <div className="rounded-2xl border border-black/[0.07] bg-white p-6">
        <p className="text-[16px] font-medium text-neutral-900">
          Les données publiques ne suffisent pas à estimer ce bien à distance.
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-neutral-600">
          Une visite permettra d’établir une valeur fiable à partir de l’état réel du bien.
        </p>
      </div>
    );
  }

  const precision = phraseImmeuble(summary);

  return (
    <div className="rounded-2xl border border-black/[0.07] bg-white p-6">
      <p className="text-[13px] text-neutral-500">Valeur estimée</p>

      <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p
          className="font-semibold tabular-nums tracking-tight text-neutral-900"
          style={{ fontSize: 'clamp(2rem, 6vw, 2.75rem)', lineHeight: 1.05 }}
        >
          {formatEuro(value)}
        </p>
        {pricePerM2 != null ? (
          <p className="text-[16px] tabular-nums font-medium text-neutral-600">
            {pricePerM2.toLocaleString('fr-FR')} €/m²
          </p>
        ) : null}
      </div>

      {dispersionElevee || low == null || high == null ? (
        <p className="mt-3 text-pretty text-[14px] leading-relaxed text-neutral-700">
          {DISPERSION_MESSAGE}
        </p>
      ) : (
        <p className="mt-2 text-[14px] tabular-nums text-neutral-600">
          Fourchette&nbsp;: {formatEuro(low)} – {formatEuro(high)}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-black/[0.06] pt-4">
        <PastilleFiabilite score={reliability} />
        <p className="text-pretty text-[13px] leading-snug text-neutral-600">
          {phraseComparables(summary)}
          {precision ? <span className="text-neutral-500"> ({precision})</span> : null}
        </p>
      </div>
    </div>
  );
}
