import { getPublishedPosts } from '@/lib/blog/posts';
import Header from '@/components/Header';

type SiteHeaderProps = {
  variant?: 'default' | 'landing';
};

export default function SiteHeader({ variant = 'default' }: SiteHeaderProps) {
  const latestPost = getPublishedPosts()[0] ?? null;
  return <Header latestPost={latestPost} variant={variant} />;
}
