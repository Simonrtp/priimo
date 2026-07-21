import { Building2, Home, MapPin } from 'lucide-react';
import type { Lead } from '@/types/lead';
import { formatLeadAddressQuery, googleMapsSearchUrl, splitStreetAndCity } from '@/lib/utils';
import { formatDetentionPrimary, formatEtage } from '@/lib/lead-display';
import { formatAcquiredPriceLine, hasDisplayableAcquiredPrice } from '@/lib/lead-valorisation';
import ScoreRing from './ScoreRing';

interface LeadDetailHeaderProps {
  lead: Pick<
    Lead,
    | 'address'
    | 'city'
    | 'postalCode'
    | 'propertyType'
    | 'surfaceM2'
    | 'etage'
    | 'acquiredYear'
    | 'acquiredPrice'
    | 'acquiredPriceReliable'
    | 'score'
  >;
  /** id du titre — sert au `aria-labelledby` du drawer. */
  titleId?: string;
  /** Affichage compact pour le plein-écran mobile (police légèrement plus dense). */
  compact?: boolean;
}

function joinDot(parts: (string | null | undefined)[]): React.ReactNode {
  const segments = parts.filter((p): p is string => Boolean(p));
  if (segments.length === 0) return null;
  return segments.map((segment, i) => (
    <span key={`${segment}-${i}`}>
      {i > 0 && <span className="mx-1.5 opacity-40">·</span>}
      {segment}
    </span>
  ));
}

/**
 * En-tête du panneau de détail :
 *   1. Bouton discret « 📍 Voir sur Google Maps »
 *   2. Lignes grises épurées : adresse, type/surface/étage, détention, prix d'achat
 *   3. Cercle de score à droite, en évidence
 */
export default function LeadDetailHeader({
  lead,
  titleId,
  compact = false,
}: LeadDetailHeaderProps) {
  const fullAddress = formatLeadAddressQuery({
    address: lead.address,
    postalCode: lead.postalCode,
    city: lead.city,
  });
  const { streetLine, cityZipLine } = splitStreetAndCity(fullAddress);
  const mapsUrl = googleMapsSearchUrl(fullAddress);

  const detentionLabel = formatDetentionPrimary(lead.acquiredYear);
  const acquiredPriceLine = hasDisplayableAcquiredPrice(lead)
    ? formatAcquiredPriceLine(lead, { strictReliable: true })
    : null;

  const typeLine = joinDot([
    lead.propertyType,
    lead.surfaceM2 != null && lead.surfaceM2 > 0 ? `${lead.surfaceM2} m²` : null,
    formatEtage(lead.etage, lead.propertyType),
  ]);
  const TypeIcon = lead.propertyType === 'Maison' ? Home : lead.propertyType ? Building2 : null;

  const streetSize = compact ? 16 : 17;
  const metaSize = compact ? 12.5 : 13;

  return (
    <div>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Voir ${fullAddress} sur Google Maps`}
        className="inline-flex items-center gap-1.5 text-mute transition-colors hover:text-ink focus-visible:text-ink focus-visible:outline-none"
        style={{ fontSize: 11.5 }}
        onClick={(e) => e.stopPropagation()}
      >
        <MapPin size={13} strokeWidth={2} aria-hidden />
        <span className="underline-offset-2 hover:underline">Voir sur Google Maps</span>
      </a>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <h2
            id={titleId}
            className="font-semibold tracking-tight text-ink"
            style={{ fontSize: streetSize, letterSpacing: '-0.02em', lineHeight: 1.3 }}
          >
            {streetLine}
          </h2>
          {cityZipLine && (
            <p className="text-mute" style={{ fontSize: metaSize }}>
              {cityZipLine}
            </p>
          )}
          {typeLine && (
            <p className="flex items-center gap-1.5 text-mute" style={{ fontSize: metaSize }}>
              {TypeIcon && <TypeIcon size={13} strokeWidth={2} className="shrink-0" aria-hidden />}
              <span>{typeLine}</span>
            </p>
          )}
          {detentionLabel && (
            <p className="text-mute" style={{ fontSize: metaSize }}>
              {detentionLabel}
            </p>
          )}
          {acquiredPriceLine && (
            <p className="text-mute" style={{ fontSize: metaSize }}>
              {acquiredPriceLine}
            </p>
          )}
        </div>
        <div className="flex flex-shrink-0 flex-col items-center pt-0.5">
          <ScoreRing score={lead.score} size={compact ? 64 : 76} />
        </div>
      </div>
    </div>
  );
}
