import type { ReactNode } from 'react';

type BlogSoftCtaProps = {
  children: ReactNode;
};

/**
 * CTA éditorial mid-article — discret, jamais « prendre RDV ».
 * Usage markdown : :::cta … :::
 */
export default function BlogSoftCta({ children }: BlogSoftCtaProps) {
  return (
    <aside
      className="blog-soft-cta my-9 rounded-2xl border border-accent/15 bg-[#FFF7F0]/70 px-5 py-4 sm:px-6 sm:py-5"
      aria-label="Pour aller plus loin"
    >
      <p className="label mb-2 text-accent-dark">Pour aller plus loin</p>
      <div className="blog-prose blog-prose--compact">{children}</div>
    </aside>
  );
}
