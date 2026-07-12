import Image from 'next/image';
import type { BlogPostSummary } from '@/lib/blog/types';
import { formatBlogDate } from '@/lib/blog/format';

type BlogAuthorCardProps = {
  post: Pick<BlogPostSummary, 'author' | 'authorImage' | 'date'>;
  compact?: boolean;
};

function authorInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || 'P';
}

function authorSubtitle(name: string): string {
  return name.trim() === 'Simon Ropiot' ? 'Fondateur de Priimo' : 'Priimo';
}

export default function BlogAuthorCard({ post, compact = false }: BlogAuthorCardProps) {
  const initial = authorInitial(post.author);

  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-black/8 bg-white px-3 py-2.5 lg:hidden">
        {post.authorImage ? (
          <Image
            src={post.authorImage}
            alt={post.author}
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF7F0] text-sm font-semibold text-accent"
            aria-hidden
          >
            {initial}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{post.author}</p>
          <p className="truncate text-xs text-gray-500">{authorSubtitle(post.author)}</p>
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-black/8 bg-white p-4">
      <div className="flex items-start gap-3">
        {post.authorImage ? (
          <Image
            src={post.authorImage}
            alt={post.author}
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FFF7F0] text-base font-semibold text-accent"
            aria-hidden
          >
            {initial}
          </span>
        )}
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">{post.author}</p>
          <p className="mt-0.5 text-sm text-gray-600">{authorSubtitle(post.author)}</p>
          <p className="mt-2 text-xs text-gray-400">Publié le {formatBlogDate(post.date)}</p>
        </div>
      </div>
    </section>
  );
}
