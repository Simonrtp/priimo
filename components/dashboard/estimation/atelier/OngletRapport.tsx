'use client';

import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import { payloadPublic } from '@/lib/estimation/rapport';
import { criteresRenseignes } from '@/lib/estimation/grille';
import { formatEuro } from '@/lib/estimation/resultat';
import type { EstimationObjet } from '@/lib/estimation/objet';

export default function OngletRapport({
  estimation,
  agencyName,
}: {
  estimation: EstimationObjet;
  agencyName: string;
}) {
  const pub = payloadPublic({
    motif: estimation.motif,
    dateValeur: estimation.dateValeur,
    commentairesPublics: estimation.commentairesPublics,
    commentairesConfidentiels: estimation.commentairesConfidentiels,
    criteresRenseignes: criteresRenseignes(estimation.grille),
  });
  const couverture = estimation.photos[0]?.url;
  const facade =
    estimation.bien.facadeCouverture && estimation.latitude != null && estimation.longitude != null
      ? `/api/facade/geo?lat=${estimation.latitude}&lng=${estimation.longitude}&format=detail`
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end print:hidden">
        <WorkspaceButton type="button" variant="secondary" onClick={() => window.print()}>
          Imprimer
        </WorkspaceButton>
      </div>
      <article className="rounded-clay border border-black/[0.06] bg-surface px-6 py-8 shadow-clay-sm">
        {(facade || couverture) && (
          <img src={facade ?? couverture} alt="" className="mb-5 h-40 w-full rounded-clay object-cover" />
        )}
        <p className="text-[12.5px] font-semibold uppercase text-text-subtle">{agencyName}</p>
        <h2 className="mt-1 text-balance text-[22px] font-semibold text-text-strong">{pub.titre}</h2>
        {pub.dateValeur ? (
          <p className="mt-2 text-[13.5px] text-text">Date de valeur : {pub.dateValeur}</p>
        ) : null}
        <p className="mt-4 text-[15px] font-medium text-text-strong">
          {estimation.address ?? 'Adresse à préciser'}
        </p>
        {estimation.priceValue != null ? (
          <p className="mt-4 font-display text-[32px] font-bold tabular-nums text-text-strong">
            {formatEuro(estimation.priceValue)}
          </p>
        ) : null}
        {pub.alerteFiabilite ? (
          <p className="mt-3 text-pretty text-[13.5px] font-medium text-text-strong">{pub.alerteFiabilite}</p>
        ) : null}
        {pub.commentaires ? (
          <p className="mt-4 text-pretty text-[14px] leading-relaxed text-text">{pub.commentaires}</p>
        ) : null}
        {estimation.pointsForts.length > 0 ? (
          <div className="mt-5">
            <p className="text-[12px] font-semibold uppercase text-text-subtle">Points forts</p>
            <ul className="mt-1 list-disc pl-5 text-[13.5px] text-text">
              {estimation.pointsForts.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="mt-8 text-pretty text-[12px] leading-relaxed text-text-subtle">{pub.mentionLegale}</p>
      </article>
    </div>
  );
}
