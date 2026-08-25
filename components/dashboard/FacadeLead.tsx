'use client';

import { useState } from 'react';
import { Building } from 'lucide-react';

/** URL unique par lead — liste et drawer partagent le même cache navigateur. */
export function facadeLeadSrc(leadId: string, format: 'liste' | 'detail' = 'detail'): string {
  return `/api/facade/${leadId}?format=${format}`;
}

export function facadeGeoSrc(
  latitude: number,
  longitude: number,
  format: 'liste' | 'detail' = 'detail',
): string {
  return `/api/facade/geo?lat=${latitude.toFixed(5)}&lng=${longitude.toFixed(5)}&format=${format}`;
}

type FacadeImageProps = {
  src: string;
  className?: string;
  lazy?: boolean;
};

function FacadeFallback({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-lg ${className ?? ''}`}
      style={{ backgroundColor: '#F1EFE8' }}
      aria-hidden
    >
      <Building size={20} strokeWidth={1.8} className="text-[#9CA3AF]" />
    </div>
  );
}

function FacadeImage({ src, className, lazy = false }: FacadeImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <FacadeFallback className={className} />;
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden
      className={`object-cover object-top rounded-lg ${className ?? ''}`}
      loading={lazy ? 'lazy' : undefined}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

type FacadeLeadProps = {
  leadId: string;
  className?: string;
  /** Lazy-load pour les vignettes hors écran dans la liste. */
  lazy?: boolean;
  format?: 'liste' | 'detail';
};

export default function FacadeLead({
  leadId,
  className,
  lazy = false,
  format = 'detail',
}: FacadeLeadProps) {
  return <FacadeImage src={facadeLeadSrc(leadId, format)} className={className} lazy={lazy} />;
}

export function FacadeStreetView({
  latitude,
  longitude,
  className,
  lazy = false,
  format = 'detail',
}: {
  latitude: number;
  longitude: number;
  className?: string;
  lazy?: boolean;
  format?: 'liste' | 'detail';
}) {
  const src = facadeGeoSrc(latitude, longitude, format);
  return <FacadeImage key={src} src={src} className={className} lazy={lazy} />;
}
