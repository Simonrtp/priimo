import Link from 'next/link';
import AboutAuthorCard from './AboutAuthorCard';
import BlogTableOfContents from '@/components/blog/BlogTableOfContents';
import type { TocItem } from '@/lib/blog/toc';

type AboutSidebarProps = {
  headings: TocItem[];
};

export default function AboutSidebar({ headings }: AboutSidebarProps) {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-28 space-y-5">
        <Link
          href="/"
          className="inline-flex text-sm font-medium text-gray-500 transition-colors hover:text-accent"
        >
          ← Accueil
        </Link>

        <AboutAuthorCard />
        <BlogTableOfContents headings={headings} />
      </div>
    </aside>
  );
}
