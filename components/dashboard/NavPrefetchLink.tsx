'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ComponentProps, type MouseEvent, type TouchEvent } from 'react';
import { useNavigationInstantanee } from '@/components/dashboard/navigation/NavigationInstantanee';

/**
 * Lien de nav : pas de préchargement au montage (sinon les six écrans
 * partent ensemble). Précharge au survol desktop / au toucher mobile.
 * Au clic, l'écran change tout de suite : onglet actif, puis squelette.
 */
export default function NavPrefetchLink({
  href,
  onClick,
  onMouseEnter,
  onTouchStart,
  onNavigate,
  prefetch,
  ...rest
}: ComponentProps<typeof Link>) {
  const router = useRouter();
  const { annoncer } = useNavigationInstantanee();
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
      // Appelé seulement quand Next navigue vraiment (pas un clic avec Ctrl ou ⌘).
      onNavigate={(e) => {
        onNavigate?.(e);
        if (cible) annoncer(cible);
      }}
      {...rest}
    />
  );
}
