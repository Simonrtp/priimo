import { getPublishedPosts } from '@/lib/blog/posts';
import Header from '@/components/Header';

export default function SiteHeader() {
  const latestPost = getPublishedPosts()[0] ?? null;
  return <Header latestPost={latestPost} />;
}
