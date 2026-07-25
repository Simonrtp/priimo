import type { ReactNode } from 'react';

/**
 * Motif unique de section du détail lead (drawer + mobile) :
 * titre petites capitales, fond blanc, filet et marges identiques.
 */
export function DetailSectionLabel({
  children,
  className = 'mb-3',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`font-semibold uppercase text-ink/75 ${className}`}
      style={{ fontSize: 12, letterSpacing: '0.06em' }}
    >
      {children}
    </p>
  );
}

export function DetailSection({
  children,
  className = '',
  'data-tour': dataTour,
}: {
  children: ReactNode;
  className?: string;
  'data-tour'?: string;
}) {
  return (
    <section
      data-tour={dataTour}
      className={`border-t border-black/[0.05] py-5 first:border-t-0 first:pt-0 ${className}`}
    >
      {children}
    </section>
  );
}
