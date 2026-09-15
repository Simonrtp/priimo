import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Reveal from '@/components/Reveal';
import type { FeatureRelated } from '@/lib/features/pages';

type RelatedPagesProps = {
  pages: [FeatureRelated, FeatureRelated];
};

export default function RelatedPages({ pages }: RelatedPagesProps) {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-8 sm:py-16">
        <Reveal direction="up">
          <p className="text-[11px] font-semibold uppercase text-[#E8743C]">
            Continuer
          </p>
          <h2 className="blog-prose-h2 !mt-3 text-balance">
            Deux portes à côté de celle-ci.
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2">
          {pages.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="group flex flex-col rounded-2xl border border-black/[0.07] bg-[#FFF7F0] px-5 py-5 transition-colors duration-200 hover:border-[#E8743C]/35 sm:px-6 sm:py-6"
            >
              <span className="text-[15px] font-semibold text-gray-900 sm:text-base">
                {page.label}
              </span>
              <span className="mt-2 text-pretty text-[14px] leading-relaxed text-gray-600 sm:text-[15px]">
                {page.blurb}
              </span>
              <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#C25E2C]">
                Lire
                <ArrowRight
                  size={14}
                  strokeWidth={2.25}
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
