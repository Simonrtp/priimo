import type { Metadata } from 'next';
import Link from 'next/link';
import Footer from '@/components/Footer';
import { LegalArticleContent } from '@/components/legal/LegalArticleContent';
import { CONFIDENTIALITE_LAST_UPDATED } from '@/lib/legal/contact';

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description: 'Politique de confidentialité et protection des données — Priimo.',
  robots: { index: true, follow: true },
};

export default function PolitiqueConfidentialitePage() {
  return (
    <main className="min-h-dvh bg-canvas flex flex-col">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-canvas"
        style={{
          background: [
            'radial-gradient(1000px 800px at 12% 18%, rgba(232, 116, 60, 0.04), transparent 70%)',
            'radial-gradient(900px 700px at 88% 82%, rgba(232, 116, 60, 0.03), transparent 70%)',
          ].join(', '),
        }}
      />
      <header className="border-b border-black/5 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link href="/" className="font-sans text-xl font-bold text-accent-dark shrink-0">
            Priimo
          </Link>
          <Link href="/login" className="text-sm text-gray-600 hover:text-accent-dark transition">
            Se connecter
          </Link>
        </div>
      </header>
      <div className="flex-1 mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-14">
        <h1 className="font-sans text-3xl font-bold text-gray-900 text-balance tracking-tight mb-2">
          Politique de confidentialité
        </h1>
        <LegalArticleContent filename="confidentialite.md" lastUpdated={CONFIDENTIALITE_LAST_UPDATED} />
        <p className="mt-12 text-center border-t border-black/10 pt-8">
          <Link href="/" className="text-sm font-medium text-accent-dark hover:underline">
            ← Retour à l&apos;accueil
          </Link>
        </p>
      </div>
      <Footer />
    </main>
  );
}
