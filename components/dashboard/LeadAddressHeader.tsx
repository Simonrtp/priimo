'use client';

import { MapPin } from 'lucide-react';
import { formatLeadAddressQuery, googleMapsSearchUrl, splitStreetAndCity } from '@/lib/utils';

interface LeadAddressHeaderProps {
  address: string;
  postalCode?: string | null;
  city?: string | null;
  id?: string;
  size?: 'drawer' | 'mobile';
}

export default function LeadAddressHeader({
  address,
  postalCode,
  city,
  id,
  size = 'drawer',
}: LeadAddressHeaderProps) {
  const fullAddress = formatLeadAddressQuery({ address, postalCode, city });
  const { streetLine, cityZipLine } = splitStreetAndCity(fullAddress);
  const mapsUrl = googleMapsSearchUrl(fullAddress);

  const streetSize = size === 'drawer' ? 17 : 15;
  const mapsBtnClass =
    size === 'drawer' ? 'mt-0.5 gap-1.5 px-2.5 py-1.5' : 'gap-1 px-2 py-1';

  return (
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Ouvrir ${fullAddress} dans Google Maps`}
        title="Ouvrir dans Google Maps"
        className={`inline-flex flex-shrink-0 items-center rounded-lg border border-accent/30 bg-accent/10 font-semibold text-accent-dark shadow-sm transition-colors hover:border-accent/45 hover:bg-accent/18 ${mapsBtnClass}`}
        style={{ fontSize: 11, letterSpacing: '0.02em' }}
        onClick={(e) => e.stopPropagation()}
      >
        <MapPin size={size === 'drawer' ? 14 : 13} strokeWidth={2.25} aria-hidden />
        Maps
      </a>

      <div className="min-w-0 flex-1">
        <h2
          id={id}
          className={`font-semibold tracking-tight text-ink ${size === 'mobile' ? 'truncate' : ''}`}
          style={{ fontSize: streetSize, letterSpacing: '-0.02em', lineHeight: 1.35 }}
        >
          {streetLine}
        </h2>
        {cityZipLine && (
          <p className="mt-1 text-mute" style={{ fontSize: size === 'drawer' ? 12.5 : 13 }}>
            {cityZipLine}
          </p>
        )}
      </div>
    </div>
  );
}
