import Link from 'next/link';
import type { ReactNode } from 'react';
import Footer from '@/components/Footer';
import { PriimoLogo } from '@/components/brand/PriimoLogo';

/** Le cadre de la page de connexion, pour les écrans du même parcours. */
export default function AuthShell({
  titre,
  sousTitre,
  children,
  pied,
}: {
  titre: string;
  sousTitre?: ReactNode;
  children: ReactNode;
  pied?: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-canvas flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10 sm:py-16">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10"
          style={{
            background: [
              'radial-gradient(900px 700px at 18% 22%, rgba(232, 116, 60, 0.07), transparent 65%)',
              'radial-gradient(820px 620px at 84% 70%, rgba(232, 116, 60, 0.055), transparent 65%)',
            ].join(', '),
          }}
        />

        <div className="w-full max-w-[420px]">
          <div className="flex justify-center mb-6">
            <Link href="/" className="inline-block">
              <PriimoLogo className="h-12" priority />
            </Link>
          </div>

          <div className="rounded-2xl bg-white border border-black/5 shadow-soft p-6 sm:p-8">
            <div className="text-center mb-6">
              <h1 className="font-sans text-2xl font-semibold text-gray-900 tracking-tight text-balance">{titre}</h1>
              {sousTitre ? <p className="mt-2 text-sm text-gray-600 text-pretty">{sousTitre}</p> : null}
            </div>
            {children}
          </div>

          {pied ? <div className="mt-6 text-center text-sm text-gray-600">{pied}</div> : null}
        </div>
      </div>
      <Footer />
    </main>
  );
}
