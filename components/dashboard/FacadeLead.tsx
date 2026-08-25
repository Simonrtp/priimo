'use client';

import { useState } from 'react';
import { Building } from 'lucide-react';

/** URL unique par lead — liste et drawer partagent le même cache navigateur. */
export function facadeLeadSrc(leadId: string, format: 'liste' | 'detail' = 'detail'): string {
  return `/api/facade/${leadId}?format=${format}`;
}

type FacadeLeadProps = {
  leadId: string;
  className?: string;
  /** Lazy-load pour les vignettes hors écran dans la liste. */
  lazy?: boolean;
  format?: 'liste' | 'detail';
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

export default function FacadeLead({ leadId, className, lazy = false, format = 'detail' }: FacadeLeadProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <FacadeFallback className={className} />;
  }

  return (
    <img
      src={facadeLeadSrc(leadId, format)}
      alt=""
      aria-hidden
      className={`object-cover object-top rounded-lg ${className ?? ''}`}
      loading={lazy ? 'lazy' : undefined}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
