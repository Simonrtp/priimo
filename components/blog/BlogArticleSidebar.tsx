import Link from 'next/link';
import BlogAuthorCard from './BlogAuthorCard';
import BlogTableOfContents from './BlogTableOfContents';
import type { TocItem } from '@/lib/blog/toc';
import type { BlogPostSummary } from '@/lib/blog/types';

type BlogArticleSidebarProps = {
  post: BlogPostSummary;
  headings: TocItem[];
};

export default function BlogArticleSidebar({ post, headings }: BlogArticleSidebarProps) {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-28 space-y-5">
        <Link
          href="/blog"
          className="inline-flex text-sm font-medium text-gray-500 transition-colors hover:text-accent"
        >
          ← Tous les articles
        </Link>

        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-gray-700"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <BlogAuthorCard post={post} />
        <BlogTableOfContents headings={headings} />
      </div>
    </aside>
  );
}
