import Reveal from '@/components/Reveal';

// === STATEMENT (bloc E) ===
// Bloc-manifeste : une phrase forte, gros texte, sur fond dark pleine largeur,
// coins arrondis. Sert de respiration et de rupture entre deux sections claires.

type StatementProps = {
  text: string;
};

export default function Statement({ text }: StatementProps) {
  return (
    <section className="bg-white py-4 sm:py-6">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <Reveal direction="scale">
          <div className="relative overflow-hidden rounded-[24px] bg-[#0A0D11] px-6 py-12 sm:rounded-[32px] sm:px-14 sm:py-20">
            {/* Orbe orange floue */}
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 h-[280px] w-[280px] rounded-full opacity-40 blur-[90px]"
              style={{ background: 'radial-gradient(circle, #E8743C 0%, transparent 70%)' }}
            />
            {/* Motif de points discret */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 15% 30%, white 1.5px, transparent 1.5px), radial-gradient(circle at 75% 70%, white 1.5px, transparent 1.5px)',
                backgroundSize: '46px 46px',
              }}
            />
            <div className="relative max-w-[820px]">
              <span
                aria-hidden
                className="block h-1 w-10 rounded-full bg-accent"
              />
              <p className="mt-5 text-balance font-sans text-[1.5rem] font-bold leading-[1.25] tracking-[-0.02em] text-white sm:text-[2rem] lg:text-[2.25rem]">
                {text}
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
