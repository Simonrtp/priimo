import Link from 'next/link';
import { formatBlogDate } from '@/lib/blog/format';
import type { BlogPostSummary } from '@/lib/blog/types';

type BlogCardProps = {
  post: BlogPostSummary;
};

function cardClassName(isDraft: boolean) {
  return `group glass grad-border flex h-full flex-col rounded-[24px] p-6 sm:p-8 ${
    isDraft ? 'opacity-90' : 'glass-hover'
  }`;
}

function CardInner({ post }: BlogCardProps) {
  const isDraft = post.draft === true;
  const primaryTag = post.tags[0];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {isDraft && (
          <span className="label inline-flex w-fit rounded-full bg-gray-100 px-3 py-1 text-gray-600">
            Bientôt
          </span>
        )}
        {primaryTag && (
          <span className="label inline-flex w-fit rounded-full bg-accent/10 px-3 py-1 text-accent-dark">
            {primaryTag}
          </span>
        )}
      </div>
      <h2
        className={`text-h3 text-balance ${isDraft ? 'text-gray-800' : 'transition-colors duration-300 group-hover:text-accent-dark'}`}
      >
        {post.title}
      </h2>
      <p className="text-body mt-3 flex-1 text-pretty">{post.description}</p>
      <p className="small-text mt-6 !normal-case !tracking-normal text-gray-500">
        {isDraft ? `Prévu le ${formatBlogDate(post.date)}` : `${formatBlogDate(post.date)} · ${post.readingTime} min de lecture`}
      </p>
    </>
  );
}

export default function BlogCard({ post }: BlogCardProps) {
  if (post.draft) {
    return (
      <article className={cardClassName(true)} aria-label={`Article à venir : ${post.title}`}>
        <CardInner post={post} />
      </article>
    );
  }

  return (
    <Link href={`/blog/${post.slug}`} className={cardClassName(false)}>
      <CardInner post={post} />
    </Link>
  );
}
