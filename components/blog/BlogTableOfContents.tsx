'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { TocItem } from '@/lib/blog/toc';

type BlogTableOfContentsProps = {
  headings: TocItem[];
  showTitle?: boolean;
  variant?: 'card' | 'plain';
  className?: string;
  scrollable?: boolean;
};

export default function BlogTableOfContents({
  headings,
  showTitle = true,
  variant = 'card',
  className = '',
  scrollable = true,
}: BlogTableOfContentsProps) {
  const [activeId, setActiveId] = useState<string | null>(headings[0]?.id ?? null);

  useEffect(() => {
    if (headings.length === 0) return;

    const elements = headings
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
          return;
        }

        const scrollY = window.scrollY;
        let current = headings[0]?.id ?? null;
        for (const el of elements) {
          if (el.offsetTop - 140 <= scrollY) current = el.id;
        }
        if (current) setActiveId(current);
      },
      {
        rootMargin: '-120px 0px -55% 0px',
        threshold: [0, 0.1, 0.5, 1],
      },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  const list = (
    <ol
      className={`space-y-1 ${scrollable ? 'blog-toc-scroll max-h-[calc(100dvh-22rem)] overflow-y-auto pr-1' : ''} ${showTitle ? 'mt-3' : ''}`}
    >
      {headings.map((item) => {
        const active = activeId === item.id;
        return (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={`block rounded-lg px-2 py-1.5 text-sm leading-snug transition-colors ${
                active
                  ? 'font-medium text-accent'
                  : 'text-gray-500 hover:bg-soft-warm/50 hover:text-accent-dark'
              }`}
            >
              {item.title}
            </a>
          </li>
        );
      })}
    </ol>
  );

  if (variant === 'plain') {
    return (
      <nav aria-label="Sommaire de l'article" className={className}>
        {list}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Sommaire de l'article"
      className={`rounded-2xl border border-black/8 bg-white p-4 ${className}`}
    >
      {showTitle && <p className="text-sm font-semibold text-gray-900">Sommaire</p>}
      {list}
    </nav>
  );
}
