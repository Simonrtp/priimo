import type { Metadata } from 'next';
import Link from 'next/link';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { fillLegalTemplate } from '@/lib/qr/legal';
import { absoluteUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Vos données',
  description:
    'Comment une agence utilisant Priimo conserve vos coordonnées, et comment exercer vos droits.',
  alternates: { canonical: '/information' },
  robots: { index: true, follow: true },
};

const FALLBACK = `## Vos données chez une agence utilisant Priimo

Priimo est l'outil de prospection utilisé par des agences immobilières indépendantes. Lorsque vos coordonnées figurent dans l'une d'elles, **c'est cette agence qui en est responsable**, pas Priimo, qui n'agit que comme sous-traitant technique.

### Combien de temps elles sont conservées

Trois ans à compter du dernier échange avec vous.

### Vos droits

Accès, rectification, effacement, opposition, limitation, portabilité. L'agence doit vous répondre sous un mois.`;

function paragraphs(md: string) {
  return md
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

export default async function InformationPage() {
  let corps = FALLBACK;
  try {
    const { data } = await createSupabaseAdminClient()
      .from('informations_legales_versions')
      .select('corps')
      .eq('version', 'page-information-2026-09-v1')
      .maybeSingle();
    if (data?.corps) corps = data.corps;
  } catch {
    /* page lisible même sans migration */
  }

  const text = fillLegalTemplate(corps, {
    agence: 'votre agence',
    lienInformation: absoluteUrl('/information'),
  });

  return (
    <main className="min-h-dvh bg-[#FFF7F0]">
      <article className="mx-auto max-w-xl px-5 py-12">
        <p className="font-brand text-[15px] italic text-[#1A2A56]">Priimo</p>
        <div className="mt-6 flex flex-col gap-5 text-[16px] leading-relaxed text-[#1A2A56]">
          {paragraphs(text).map((block) => {
            const heading = block.match(/^#{2,3}\s+(.*)$/);
            if (heading) {
              const Tag = block.startsWith('###') ? 'h3' : 'h2';
              return (
                <Tag
                  key={heading[1]}
                  className="font-display text-[20px] font-semibold text-balance"
                >
                  {heading[1]}
                </Tag>
              );
            }
            return (
              <p key={block.slice(0, 40)} className="text-pretty">
                {block.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
                  part.startsWith('**') && part.endsWith('**') ? (
                    <strong key={i}>{part.slice(2, -2)}</strong>
                  ) : (
                    part
                  ),
                )}
              </p>
            );
          })}
        </div>
        <p className="mt-10 text-[13.5px] text-[#5A6573]">
          Politique complète :{' '}
          <Link href="/politique-de-confidentialite" className="text-[#1A2A56] underline underline-offset-2">
            politique de confidentialité
          </Link>
          .
        </p>
      </article>
    </main>
  );
}
