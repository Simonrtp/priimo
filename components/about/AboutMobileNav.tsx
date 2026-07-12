'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import AboutAuthorCard from './AboutAuthorCard';
import BlogTableOfContents from '@/components/blog/BlogTableOfContents';
import type { TocItem } from '@/lib/blog/toc';

type AboutMobileNavProps = {
  headings: TocItem[];
};

export default function AboutMobileNav({ headings }: AboutMobileNavProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const tabletOnly = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');
    const sync = () => setOpen(tabletOnly.matches);
    sync();
    tabletOnly.addEventListener('change', sync);
    return () => tabletOnly.removeEventListener('change', sync);
  }, []);

  if (headings.length === 0) {
    return (
      <div className="mt-6 lg:hidden">
        <AboutAuthorCard compact />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4 lg:hidden">
      <AboutAuthorCard compact />

      <div className="rounded-2xl border border-black/8 bg-white">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          <span className="text-sm font-semibold text-gray-900">Sommaire</span>
          <ChevronDown
            size={18}
            className={`shrink-0 text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
        {open && (
          <div className="border-t border-black/6 px-3 pb-3 pt-2">
            <BlogTableOfContents
              headings={headings}
              showTitle={false}
              variant="plain"
              scrollable={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
