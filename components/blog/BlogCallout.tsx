import type { ReactNode } from 'react';

type BlogCalloutProps = {
  children: ReactNode;
};

/** Encadré Priimo — note d'auteur, visuellement séparé du corps éditorial. */
export default function BlogCallout({ children }: BlogCalloutProps) {
  return (
    <aside
      className="blog-callout my-10 rounded-2xl border border-accent/20 bg-[#FFF7F0] p-6 sm:p-7"
      aria-label="Encadré Priimo"
    >
      <p className="label mb-3 text-accent-dark">Encadré Priimo</p>
      <div className="blog-prose blog-prose--compact">{children}</div>
    </aside>
  );
}
