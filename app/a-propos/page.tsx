import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import FinalCTA from '@/components/FinalCTA';
import BlogMarkdown from '@/components/blog/BlogMarkdown';
import AboutSidebar from '@/components/about/AboutSidebar';
import AboutMobileNav from '@/components/about/AboutMobileNav';
import { getAboutContent } from '@/lib/about/content';
import { extractH2Headings } from '@/lib/blog/toc';
import { CALENDLY_URL } from '@/lib/calendly';

export const metadata: Metadata = {
  title: 'À propos',
  description:
    'Simon Ropiot, fondateur de Priimo : pourquoi un étudiant en école d\'ingénieurs a construit un outil de prospection immobilière basé sur les données publiques.',
  alternates: { canonical: '/a-propos' },
  openGraph: {
    title: 'À propos — Priimo',
    description:
      'L\'histoire de Priimo : écouter les agences, croiser les données publiques, et refuser le volume aveugle.',
    url: '/a-propos',
    type: 'website',
    locale: 'fr_FR',
    siteName: 'Priimo',
    images: [{ url: '/Tintin_image_2.jpg', alt: 'Simon Ropiot, fondateur de Priimo' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'À propos — Priimo',
    description:
      'L\'histoire de Priimo : écouter les agences, croiser les données publiques, et refuser le volume aveugle.',
    images: ['/Tintin_image_2.jpg'],
  },
  robots: { index: true, follow: true },
};

export default function AboutPage() {
  const content = getAboutContent();
  const headings = extractH2Headings(content);

  return (
    <>
      <SiteHeader />
      <main className="blog-article-page mx-auto w-full max-w-[1200px] px-5 pb-8 pt-28 sm:px-8 sm:pb-12 sm:pt-32 min-w-0">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-16">
          <AboutSidebar headings={headings} />

          <div className="min-w-0 lg:max-w-[800px]">
            <header>
              <h1 className="font-sans text-[1.75rem] font-bold leading-[1.15] tracking-[-0.02em] text-gray-900 text-balance sm:text-[2.25rem] lg:text-[2.5rem]">
                À propos
              </h1>
              <p className="small-text mt-4 !normal-case !tracking-normal text-gray-500">
                Moi, Simon étudiant
              </p>
            </header>

            <AboutMobileNav headings={headings} />

            <article className="mt-8 lg:mt-10">
              <BlogMarkdown source={content} headings={headings} />
              <div className="mt-10 border-t border-black/8 pt-8">
                <a
                  href={CALENDLY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary inline-flex items-center gap-1.5 px-6 py-3 text-[15px]"
                >
                  Réserver une démo
                  <span data-arrow aria-hidden>
                    →
                  </span>
                </a>
              </div>
            </article>
          </div>
        </div>
      </main>
      <FinalCTA />
    </>
  );
}
