import Reveal from '@/components/Reveal';
import CtaButton from '@/components/CtaButton';

export default function FeatureCta() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1200px] px-5 pb-16 sm:px-8 sm:pb-20">
        <Reveal direction="up">
          <div className="rounded-[24px] bg-[#FFF7F0] px-6 py-10 text-center sm:rounded-[32px] sm:px-12 sm:py-14">
            <h2 className="text-balance font-sans text-[1.5rem] font-bold leading-tight text-gray-900 sm:text-[1.75rem]">
              Voir Priimo sur votre secteur.
            </h2>
            <div className="mt-6">
              <CtaButton size="lg">
                Réserver une démo
                <span data-arrow aria-hidden>
                  →
                </span>
              </CtaButton>
            </div>
            <p className="mt-4 text-[14px] font-medium text-gray-600">
              1 mois gratuit sans carte bancaire
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
