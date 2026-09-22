import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Imprimer l’avis de valeur',
  robots: { index: false, follow: false },
};

export default function ImprimerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
