import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Avis de valeur',
  robots: { index: false, follow: false },
};

export default function AvisLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#F7F4EF] text-ink antialiased">
      {children}
    </div>
  );
}
