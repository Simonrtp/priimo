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
      className={`uppercase tracking-widest text-mute ${className}`}
      style={{ fontSize: 9, letterSpacing: '0.18em' }}
    >
      {children}
    </p>
  );
}

export function DetailSection({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border-t border-black/[0.05] py-5 first:border-t-0 first:pt-0 ${className}`}>
      {children}
    </section>
  );
}
