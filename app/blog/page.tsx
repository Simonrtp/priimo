import SiteHeader from '@/components/SiteHeader';
import FinalCTA from '@/components/FinalCTA';
import BlogCard from '@/components/blog/BlogCard';
import { getAllPosts } from '@/lib/blog/posts';
import { blogIndexMetadata } from '@/lib/blog/seo';

export const metadata = blogIndexMetadata();

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1200px] px-5 pb-8 pt-28 sm:px-8 sm:pb-12 sm:pt-32 min-w-0">
        <h1 className="text-h1 max-w-3xl text-balance">Le blog Priimo</h1>
        <p className="text-body mt-4 max-w-2xl text-pretty sm:mt-5">
          Prospection immobilière, données publiques et réglementation — ce qu&apos;il faut savoir
          pour trouver des vendeurs avant le marché.
        </p>

        {posts.length === 0 ? (
          <p className="text-body mt-12 text-gray-600">Aucun article pour le moment.</p>
        ) : (
          <div className="mt-12 grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-2">
            {posts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        )}
      </main>
      <FinalCTA />
    </>
  );
}
