import { Building2, Home, MapPin } from 'lucide-react';
import type { Lead } from '@/types/lead';
import { formatLeadAddressQuery, formatPrice, googleMapsSearchUrl } from '@/lib/utils';
import { formatEtage } from '@/lib/lead-display';
import { hasDisplayableAcquiredPrice } from '@/lib/lead-valorisation';
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

/** Retire CP / ville déjà collés dans le champ adresse pour éviter les doublons. */
function streetOnly(
  address: string,
  postalCode?: string | null,
  city?: string | null,
): string {
  let street = address.trim();
  if (postalCode?.trim()) {
    const cp = postalCode.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    street = street.replace(new RegExp(`[,\\s]*${cp}\\b.*$`, 'i'), '').trim();
  }
  if (city?.trim()) {
    const c = city.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    street = street.replace(new RegExp(`[,\\s]*${c}\\s*$`, 'i'), '').trim();
  }
  street = street.replace(/,?\s*\d{5}(\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-']*)?\s*$/u, '').trim();
  return street || address.trim();
}

function cityLine(postalCode?: string | null, city?: string | null): string | null {
  const cp = postalCode?.trim() || '';
  const c = city?.trim() || '';
  if (cp && c) return `${cp} ${c}`;
  if (c) return c;
  if (cp) return cp;
  return null;
}

/**
 * En-tête du panneau de détail :
 *   1. Lien Google Maps
 *   2. Rue · CP ville · type/surface/étage · prix étiqueté
 *   3. Score à droite (libellé Score)
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
  const streetLine = streetOnly(lead.address, lead.postalCode, lead.city);
  const cityZipLine = cityLine(lead.postalCode, lead.city);
  const mapsUrl = googleMapsSearchUrl(fullAddress);

  const priceLine =
    hasDisplayableAcquiredPrice(lead) && lead.acquiredPrice != null
      ? `${formatPrice(lead.acquiredPrice)} €`
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
          {priceLine && (
            <div className="pt-1">
              <p className="text-mute" style={{ fontSize: 11 }}>
                Dernier prix d&apos;acquisition
              </p>
              <p className="font-medium tabular text-ink" style={{ fontSize: metaSize }}>
                {priceLine}
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-shrink-0 flex-col items-center pt-0.5">
          <ScoreRing score={lead.score} size={compact ? 64 : 76} />
          <p className="mt-1 text-mute" style={{ fontSize: 10 }}>
            Score
          </p>
        </div>
      </div>
    </div>
  );
}
