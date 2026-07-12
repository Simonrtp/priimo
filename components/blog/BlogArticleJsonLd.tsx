import type { BlogPost } from '@/lib/blog/types';
import { blogArticleJsonLd } from '@/lib/blog/seo';

type BlogArticleJsonLdProps = {
  post: BlogPost;
};

export default function BlogArticleJsonLd({ post }: BlogArticleJsonLdProps) {
  const jsonLd = blogArticleJsonLd(post);

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
