import Reveal from '@/components/Reveal';
import type { FeatureProofItem } from '@/lib/features/pages';

type ProofBlockProps = {
  intro: string;
  items: FeatureProofItem[];
};

export default function ProofBlock({ intro, items }: ProofBlockProps) {
  return (
    <section className="bg-[#FFF7F0]">
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-8 sm:py-16">
        <Reveal direction="up">
          <p className="text-[11px] font-semibold uppercase text-[#E8743C]">
            Preuve
          </p>
          <h2 className="blog-prose-h2 !mt-3 max-w-[40rem] text-balance">
            {intro}
          </h2>
        </Reveal>
        <ul className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-2">
          {items.map((item) => (
            <li
              key={item.source}
              className="rounded-2xl border border-[#3D5A80]/15 bg-white px-5 py-4 sm:px-6 sm:py-5"
            >
              <p className="text-[12px] font-semibold uppercase text-[#3D5A80]">
                {item.source}
              </p>
              <p className="mt-2 text-pretty text-[15px] leading-relaxed text-gray-700 sm:text-base">
                {item.fact}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
