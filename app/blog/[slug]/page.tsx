import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import FinalCTA from '@/components/FinalCTA';
import BlogMarkdown from '@/components/blog/BlogMarkdown';
import BlogArticleFooter from '@/components/blog/BlogArticleFooter';
import BlogArticleJsonLd from '@/components/blog/BlogArticleJsonLd';
import BlogArticleSidebar from '@/components/blog/BlogArticleSidebar';
import BlogMobileArticleNav from '@/components/blog/BlogMobileArticleNav';
import { formatBlogDate } from '@/lib/blog/format';
import { extractH2Headings } from '@/lib/blog/toc';
import { getAllSlugs, getPostBySlug } from '@/lib/blog/posts';
import { blogArticleMetadata } from '@/lib/blog/seo';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return blogArticleMetadata(post);
}

export default async function BlogArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const headings = extractH2Headings(post.content);

  return (
    <>
      <BlogArticleJsonLd post={post} />
      <SiteHeader />
      <main className="blog-article-page mx-auto w-full max-w-[1200px] px-5 pb-8 pt-28 sm:px-8 sm:pb-12 sm:pt-32 min-w-0">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-16">
          <BlogArticleSidebar post={post} headings={headings} />

          <div className="min-w-0 lg:max-w-[800px]">
            <header>
              <h1 className="text-h1 headline text-balance">
                {post.title}
              </h1>
              <p className="small-text mt-4 !normal-case !tracking-normal text-gray-500">
                {formatBlogDate(post.date)} · {post.readingTime} min de lecture
              </p>
            </header>

            <BlogMobileArticleNav post={post} headings={headings} />

            <article className="mt-8 lg:mt-10">
              <BlogMarkdown source={post.content} headings={headings} />
              <BlogArticleFooter />
            </article>
          </div>
        </div>
      </main>
      <FinalCTA />
    </>
  );
}
