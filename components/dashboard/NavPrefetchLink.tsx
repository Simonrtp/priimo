'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ComponentProps, type MouseEvent, type TouchEvent } from 'react';

/**
 * Lien de nav : pas de préchargement au montage (sinon les six écrans
 * partent ensemble). Précharge au survol desktop / au toucher mobile.
 */
export default function NavPrefetchLink({
  href,
  onClick,
  onMouseEnter,
  onTouchStart,
  prefetch,
  ...rest
}: ComponentProps<typeof Link>) {
  const router = useRouter();
  const cible = typeof href === 'string' ? href : href.pathname ?? '';

  function precharger() {
    if (!cible) return;
    // `full` : RSC + données, pas seulement loading.tsx.
    // Sans ça, le survol ne gagne que le squelette.
    router.prefetch(cible, { kind: 'full' } as Parameters<typeof router.prefetch>[1]);
  }

  return (
    <Link
      href={href}
      prefetch={prefetch ?? false}
      onMouseEnter={(e) => {
        precharger();
        onMouseEnter?.(e);
      }}
      onTouchStart={(e) => {
        precharger();
        onTouchStart?.(e as TouchEvent<HTMLAnchorElement>);
      }}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
      }}
      {...rest}
    />
  );
}
