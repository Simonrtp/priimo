import Link from 'next/link';
import { formatBlogDate } from '@/lib/blog/format';
import type { BlogPostSummary } from '@/lib/blog/types';

type BlogCardProps = {
  post: BlogPostSummary;
};

export default function BlogCard({ post }: BlogCardProps) {
  const primaryTag = post.tags[0];

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group glass glass-hover grad-border flex h-full flex-col rounded-[24px] p-6 sm:p-8"
    >
      {primaryTag && (
        <span className="label mb-4 inline-flex w-fit rounded-full bg-accent/10 px-3 py-1 text-accent-dark">
          {primaryTag}
        </span>
      )}
      <h2 className="text-h3 text-balance transition-colors duration-300 group-hover:text-accent-dark">
        {post.title}
      </h2>
      <p className="text-body mt-3 flex-1 text-pretty">{post.description}</p>
      <p className="small-text mt-6 !normal-case !tracking-normal text-gray-500">
        {formatBlogDate(post.date)} · {post.readingTime} min de lecture
      </p>
    </Link>
  );
}
