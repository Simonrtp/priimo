import Reveal from '@/components/Reveal';

// === SECTION HEAD ===
// Titre H2 orange + paragraphe(s), utilisé au-dessus d'une grille ou d'un bloc
// pleine largeur. La colonne de texte reste lisible (~680px).

type SectionHeadProps = {
  id?: string;
  title: string;
  paragraphs: string[];
  align?: 'left' | 'center';
};

export default function SectionHead({
  id,
  title,
  paragraphs,
  align = 'left',
}: SectionHeadProps) {
  const alignCls = align === 'center' ? 'mx-auto text-center' : '';
  return (
    <Reveal direction="up" className={`max-w-[680px] ${alignCls}`}>
      <h2
        id={id}
        className={`blog-prose-h2 !mt-0 ${id ? 'blog-scroll-anchor' : ''}`}
      >
        {title}
      </h2>
      {paragraphs.map((p) => (
        <p key={p} className="blog-prose-p text-pretty">
          {p}
        </p>
      ))}
    </Reveal>
  );
}
