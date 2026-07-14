import Image from 'next/image';

export const PRIIMO_LOGO_WORDMARK = '/logoprii.png';
export const PRIIMO_LOGO_MARK = '/faviconpriimo.png';

const WORDMARK_WIDTH = 2446;
const WORDMARK_HEIGHT = 1153;

type PriimoLogoProps = {
  variant?: 'wordmark' | 'mark';
  className?: string;
  imageClassName?: string;
  priority?: boolean;
};

/** Logo Priimo (wordmark ou P seul) avec coins arrondis sur le fond noir. */
export function PriimoLogo({
  variant = 'wordmark',
  className = '',
  imageClassName = '',
  priority = false,
}: PriimoLogoProps) {
  if (variant === 'mark') {
    return (
      <span className={`inline-flex overflow-hidden rounded-xl ${className}`.trim()}>
        <Image
          src={PRIIMO_LOGO_MARK}
          alt="Priimo"
          width={1024}
          height={1024}
          className={`size-full object-contain ${imageClassName}`.trim()}
          priority={priority}
        />
      </span>
    );
  }

  return (
    <span className={`inline-flex overflow-hidden rounded-xl ${className}`.trim()}>
      <Image
        src={PRIIMO_LOGO_WORDMARK}
        alt="Priimo"
        width={WORDMARK_WIDTH}
        height={WORDMARK_HEIGHT}
        className={`h-full w-auto object-contain ${imageClassName}`.trim()}
        priority={priority}
      />
    </span>
  );
}
