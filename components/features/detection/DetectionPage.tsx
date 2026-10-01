import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import Footer from '@/components/Footer';
import CtaButton from '@/components/CtaButton';
import ProductShot from '@/components/features/blocks/ProductShot';
import type { FeaturePageContent } from '@/lib/features/pages';

export default function DetectionPage({ page }: { page: FeaturePageContent }) {
  return (
    <>
      <SiteHeader />
      <main className="detection-page min-w-0 overflow-x-clip">
        <header className="detection-hero">
          <div className="detection-hero-inner">
            <h1 className="detection-hero-title">
              La pige est terminée, <span className="detection-hero-tail">le terrain reprend.</span>
            </h1>
          </div>
        </header>

        <section className="detection-section" aria-labelledby="detection-mecanisme">
          <div className="detection-wrap detection-wrap--narrow">
            <h2 id="detection-mecanisme" className="sr-only">
              Comment Priimo prépare le terrain
            </h2>
            {page.mecanisme.map((paragraph) => (
              <p key={paragraph} className="detection-lead">
                {paragraph}
              </p>
            ))}
          </div>
        </section>

        {page.benefits.map((benefit) => (
          <section key={benefit.title} className="detection-section">
            <div className="detection-wrap detection-split">
              <div className="detection-split-copy">
                <h2 className="detection-heading">{benefit.title}</h2>
                <p className="detection-body">{benefit.body}</p>
              </div>
              <div className="detection-split-visual">
                <ProductShot {...benefit.capture} />
              </div>
            </div>
          </section>
        ))}

        <section className="detection-section" aria-labelledby="detection-proof">
          <div className="detection-wrap">
            <h2 id="detection-proof" className="detection-heading detection-heading--wide">
              {page.proofIntro}
            </h2>
            <ul className="detection-proof">
              {page.proof.map((item) => (
                <li key={item.source} className="detection-proof-item">
                  <p className="detection-proof-source">{item.source}</p>
                  <p className="detection-body">{item.fact}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="detection-section" aria-labelledby="detection-related">
          <div className="detection-wrap">
            <h2 id="detection-related" className="detection-heading">
              Deux portes à côté de celle-ci.
            </h2>
            <div className="detection-related">
              {page.related.map((related) => (
                <Link key={related.href} href={related.href} className="detection-related-card">
                  <span className="detection-related-label">{related.label}</span>
                  <span className="detection-body">{related.blurb}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="detection-section detection-section--cta">
          <div className="detection-wrap detection-wrap--narrow detection-cta">
            <h2 className="detection-heading">Voir Priimo sur votre secteur.</h2>
            <CtaButton size="lg">
              Réserver une démo
              <span data-arrow aria-hidden>
                →
              </span>
            </CtaButton>
            <p className="detection-note">1 mois gratuit sans carte bancaire</p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
