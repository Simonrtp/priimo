import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Estimation de votre bien',
  // La page vit dans l'iframe du site de l'agence : elle n'a pas à exister
  // séparément dans les moteurs de recherche.
  robots: { index: false, follow: false },
};

/** Layout autonome : ni en-tête ni pied de page Priimo. */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] bg-white text-neutral-900 antialiased">{children}</div>;
}
