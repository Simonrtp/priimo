import type { ReactNode } from 'react';

type BlogNoteProps = {
  children: ReactNode;
};

/** Note / avertissement (mention légale, précision réglementaire). */
export default function BlogNote({ children }: BlogNoteProps) {
  return (
    <aside
      className="blog-note my-8 rounded-xl border border-blue/20 bg-soft-cool/60 px-5 py-4 sm:px-6 sm:py-5"
      role="note"
    >
      <p className="label mb-2 text-blue-dark">Note</p>
      <div className="blog-prose blog-prose--compact">{children}</div>
    </aside>
  );
}
