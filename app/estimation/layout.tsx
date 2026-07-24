import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Estimer mon bien',
  description:
    'Estimez gratuitement la valeur de votre bien à partir des transactions réelles (DVF) et des diagnostics énergétiques publics.',
  robots: { index: true, follow: true },
  alternates: { canonical: '/estimation' },
};

/** Layout standalone : pas de header / footer B2B. */
export default function EstimationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[#FFF7F0] text-gray-700 antialiased">
      {children}
    </div>
  );
}
