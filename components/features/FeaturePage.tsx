import SiteHeader from '@/components/SiteHeader';
import FinalCTA from '@/components/FinalCTA';
import Reveal from '@/components/Reveal';
import FeatureEnClair from '@/components/features/FeatureEnClair';
import type { FeaturePageContent } from '@/lib/features/pages';

type FeaturePageProps = {
  content: FeaturePageContent;
};

export default function FeaturePage({ content }: FeaturePageProps) {
  return (
    <>
      <SiteHeader />
      <main className="feature-page min-w-0 overflow-x-clip">
        <header className="bg-[#FFF7F0] pt-28 pb-14 sm:pt-32 sm:pb-16">
          <div className="mx-auto max-w-[760px] px-5 sm:px-8 min-w-0">
            <Reveal direction="up">
              <p className="text-[11px] font-semibold uppercase text-[#E8743C] [letter-spacing:0.08em]">
                {content.label}
              </p>
              <h1 className="mt-3 font-sans text-[1.75rem] font-bold leading-[1.15] tracking-[-0.02em] text-gray-900 text-balance sm:text-[2.25rem] lg:text-[2.5rem]">
                {content.h1}
              </h1>
              <p className="text-body mt-4 text-gray-600 text-pretty">{content.accroche}</p>
            </Reveal>
          </div>
        </header>

        {content.sections.map((section, index) => (
          <div key={section.title} className={index % 2 === 0 ? 'bg-white' : 'bg-canvas'}>
            <div className="mx-auto max-w-[760px] px-5 py-10 sm:px-8 sm:py-12 min-w-0">
              <Reveal direction="up" delay={index * 60}>
                <section>
                  <h2
                    id={section.id}
                    className={`blog-prose-h2 blog-scroll-anchor ${index === 0 ? '!mt-0' : ''}`}
                  >
                    {section.title}
                  </h2>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="blog-prose-p text-pretty">
                      {paragraph}
                    </p>
                  ))}
                </section>
              </Reveal>
            </div>
          </div>
        ))}

        <div className="bg-white">
          <div className="mx-auto max-w-[760px] px-5 pb-10 sm:px-8 sm:pb-14 min-w-0">
            <Reveal direction="up" delay={content.sections.length * 60}>
              <FeatureEnClair text={content.enClair} />
            </Reveal>
          </div>
        </div>
      </main>
      <FinalCTA />
    </>
  );
}
