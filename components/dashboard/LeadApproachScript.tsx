'use client';

import type { Lead } from '@/types/lead';
import { buildLeadRecap, recapHeadline } from '@/lib/lead-recap';
import { DetailSection, DetailSectionLabel } from './LeadDetailSection';

function capitalizeFr(value: string): string {
  if (!value) return value;
  return value.charAt(0).toLocaleUpperCase('fr') + value.slice(1);
}

/**
 * Récap pour l’agent avant l’appel — faits de la fiche, pas un texte à lire.
 */
export default function LeadApproachScript({ lead }: { lead: Lead }) {
  const recap = buildLeadRecap(lead);
  const empty = recap.faits.length === 0 && !recap.note && !recap.bien;

  return (
    <DetailSection>
      <DetailSectionLabel>Récap infos</DetailSectionLabel>
      <div
        className="rounded-[16px] px-4 py-3.5"
        style={{ backgroundColor: '#EAEFF5' }}
      >
        <p
          className="text-pretty font-semibold text-text-strong"
          style={{ fontSize: 16, lineHeight: 1.3 }}
        >
          {recapHeadline(recap)}
        </p>
        {recap.whoDetail ? (
          <p className="mt-1 text-pretty text-text-muted" style={{ fontSize: 13 }}>
            {recap.whoDetail}
          </p>
        ) : null}

        {recap.faits.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1.5">
            {recap.faits.map((fait) => (
              <li
                key={fait}
                className="text-pretty text-text"
                style={{ fontSize: 13.5, lineHeight: 1.4 }}
              >
                {capitalizeFr(fait)}
              </li>
            ))}
          </ul>
        ) : null}

        {recap.note ? (
          <p className="mt-3 text-pretty text-text" style={{ fontSize: 13.5, lineHeight: 1.4 }}>
            Dernière note · {recap.note}
          </p>
        ) : null}

        {empty ? (
          <p className="mt-2 text-pretty text-text-muted" style={{ fontSize: 13.5 }}>
            Peu d’éléments pour préparer l’appel. Le suivi reste dans la fiche.
          </p>
        ) : null}
      </div>
    </DetailSection>
  );
}
