import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AppShell } from '@/components/AppShell';
import { checkSupabaseConnection, fetchDirectorFollowupCount } from '@/lib/queries/admin';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Priimo Admin',
  description: 'Outil interne — localhost uniquement',
  robots: 'noindex, nofollow',
};

/** Données live Supabase — pas de pré-rendu statique, pas de cache. */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [supabaseOk, followupCount] = await Promise.all([
    checkSupabaseConnection(),
    fetchDirectorFollowupCount().catch(() => 0),
  ]);

  return (
    <html lang="fr">
      <body className={`${inter.variable} font-sans`}>
        <AppShell supabaseOk={supabaseOk} followupCount={followupCount}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
