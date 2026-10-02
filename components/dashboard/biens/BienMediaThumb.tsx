'use client';

import { estUrlVideo } from '@/lib/bien-photos';

/** Miniature photo ou vidéo (même cadre). */
export default function BienMediaThumb({
  url,
  className = 'size-full object-cover',
  alt = '',
}: {
  url: string;
  className?: string;
  alt?: string;
}) {
  if (estUrlVideo(url)) {
    return (
      <video
        src={url}
        className={className}
        muted
        playsInline
        preload="metadata"
        aria-label={alt || undefined}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} loading="lazy" decoding="async" />;
}
