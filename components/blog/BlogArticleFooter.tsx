import Link from 'next/link';
import { CALENDLY_URL } from '@/lib/calendly';

export default function BlogArticleFooter() {
  return (
    <footer className="mt-14 border-t border-black/10 pt-10">
      <div className="rounded-2xl border border-black/8 bg-white/80 p-6 text-center shadow-soft sm:p-8">
        <h2 className="text-h3 text-balance">Voir comment Priimo travaille votre secteur</h2>
        <p className="text-body mx-auto mt-3 max-w-md text-pretty">
          Chaque lundi, une liste courte d&apos;adresses hors portails — contexte, signaux, et
          contacts professionnels lorsqu&apos;ils existent.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/" className="btn btn-primary px-7 py-3.5 text-base">
            Découvrir Priimo
            <span data-arrow aria-hidden>
              →
            </span>
          </Link>
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-accent-dark transition hover:underline"
          >
            En savoir plus avec un expert
          </a>
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
