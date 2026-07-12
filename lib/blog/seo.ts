import type { Metadata } from 'next';
import { absoluteUrl } from '@/lib/site-url';
import type { BlogPost, BlogPostSummary } from './types';

const DEFAULT_OG = '/Logo.png';

export function blogIndexMetadata(): Metadata {
  const title = 'Le blog Priimo';
  const description =
    'Prospection immobilière, données publiques et réglementation — ce qu\'il faut savoir pour trouver des vendeurs avant le marché.';

  return {
    title,
    description,
    alternates: { canonical: '/blog' },
    openGraph: {
      title,
      description,
      url: '/blog',
      type: 'website',
      locale: 'fr_FR',
      siteName: 'Priimo',
      images: [{ url: DEFAULT_OG, alt: 'Priimo' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [DEFAULT_OG],
    },
    robots: { index: true, follow: true },
  };
}

export function blogArticleMetadata(post: BlogPostSummary): Metadata {
  const ogImage = post.ogImage ?? DEFAULT_OG;
  const canonical = `/blog/${post.slug}`;

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical },
    openGraph: {
      title: post.title,
      description: post.description,
      url: canonical,
      type: 'article',
      locale: 'fr_FR',
      siteName: 'Priimo',
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
      images: [{ url: ogImage, alt: post.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: [ogImage],
    },
    robots: { index: true, follow: true },
  };
}

export function blogArticleJsonLd(post: BlogPost) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: {
      '@type': 'Organization',
      name: post.author,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Priimo',
      logo: {
        '@type': 'ImageObject',
        url: absoluteUrl('/Logo.png'),
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': absoluteUrl(`/blog/${post.slug}`),
    },
    image: absoluteUrl(post.ogImage ?? '/Logo.png'),
    keywords: post.tags.join(', '),
  };
}
