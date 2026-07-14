import type { Metadata } from 'next';

type FeaturePageMeta = {
  title: string;
  description: string;
  path: string;
};

export function featurePageMetadata({ title, description, path }: FeaturePageMeta): Metadata {
  const ogTitle = `${title} — Priimo`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: ogTitle,
      description,
      url: path,
      type: 'website',
      locale: 'fr_FR',
      siteName: 'Priimo',
      images: [{ url: '/logoprii.png', alt: 'Priimo' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description,
      images: ['/logoprii.png'],
    },
    robots: { index: true, follow: true },
  };
}
