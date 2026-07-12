import Link from 'next/link';
import CtaButton from '@/components/CtaButton';

export default function BlogArticleFooter() {
  return (
    <footer className="mt-14 border-t border-black/10 pt-10">
      <div className="rounded-2xl border border-black/8 bg-white/80 p-6 text-center shadow-soft sm:p-8">
        <h2 className="text-h3 text-balance">Prêt à tester Priimo sur votre secteur ?</h2>
        <p className="text-body mx-auto mt-3 max-w-md text-pretty">
          Réservez une démo de 20 minutes. Sans engagement, disponibilité du secteur vérifiée en direct.
        </p>
        <div className="mt-6">
          <CtaButton size="lg">
            Réserver une démo
            <span data-arrow aria-hidden>
              →
            </span>
          </CtaButton>
        </div>
      </div>
      <p className="mt-8 text-center">
        <Link href="/blog" className="text-sm font-medium text-accent-dark transition hover:underline">
          ← Retour au blog
        </Link>
      </p>
    </footer>
  );
}
