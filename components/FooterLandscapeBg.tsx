import Image from 'next/image';

export default function FooterLandscapeBg() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[52%] max-h-[520px] overflow-hidden"
    >
      <Image
        src="/Lyon1.jpg"
        alt=""
        fill
        sizes="100vw"
        className="object-cover object-bottom"
        quality={88}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(
            to bottom,
            #1A2430 0%,
            rgba(26, 36, 48, 0.94) 10%,
            rgba(17, 20, 24, 0.82) 24%,
            rgba(14, 17, 22, 0.58) 40%,
            rgba(14, 17, 22, 0.32) 58%,
            rgba(14, 17, 22, 0.1) 74%,
            transparent 92%
          )`,
        }}
      />
    </div>
  );
}
