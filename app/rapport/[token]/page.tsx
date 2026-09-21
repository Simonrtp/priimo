import type { Metadata } from 'next';
import RapportPublicClient from '@/components/rapport/RapportPublicClient';

export const metadata: Metadata = {
  title: 'Avis de valeur',
  robots: { index: false, follow: false },
};

export default async function RapportPublicPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <RapportPublicClient token={token} />;
}
