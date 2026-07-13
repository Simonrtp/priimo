import Image from 'next/image';

export default function FooterLandscapeBg() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[58%] max-h-[540px] overflow-hidden"
      style={{
        maskImage:
          'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.06) 10%, rgba(0,0,0,0.38) 26%, rgba(0,0,0,0.78) 42%, black 56%, black 100%)',
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.06) 10%, rgba(0,0,0,0.38) 26%, rgba(0,0,0,0.78) 42%, black 56%, black 100%)',
      }}
    >
      <Image
        src="/Lyon1.jpg"
        alt=""
        fill
        sizes="100vw"
        className="object-cover object-bottom opacity-[0.88]"
        quality={75}
        loading="lazy"
        fetchPriority="low"
      />
      {/* Fondu progressif vers le dégradé sombre de la section */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(
            to bottom,
            rgba(26, 36, 48, 0) 0%,
            rgba(26, 36, 48, 0.32) 14%,
            rgba(17, 20, 24, 0.52) 30%,
            rgba(14, 17, 22, 0.38) 46%,
            rgba(14, 17, 22, 0.2) 62%,
            rgba(14, 17, 22, 0.07) 78%,
            transparent 100%
          )`,
        }}
      />
      {/* Légère teinte bleutée pour harmoniser ciel + photo */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background:
            'linear-gradient(to bottom, #1A2430 0%, rgba(26,36,48,0.45) 22%, transparent 55%)',
        }}
      />
    </div>
  );
}
