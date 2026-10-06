import { PrintStyles } from '@/components/rapport/print/Gabarit';
import PageGenereeHtml from '@/components/rapport/print/PageGenereeHtml';
import AvisPublicBarre from '@/components/rapport/print/AvisPublicBarre';
import { assemblerAvisPublic } from '@/lib/rapport/avis-public';
import { normaliserCouleurPrincipale } from '@/lib/rapport/identite';
import { pagePourPdf } from '@/lib/rapport/pages';

export const dynamic = 'force-dynamic';

export default async function AvisPublicPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await assemblerAvisPublic(token);
  if (!result.ok) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-12">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">Avis de valeur</h1>
        <p className="mt-3 text-pretty text-[15px] text-mute">{result.error}</p>
      </main>
    );
  }

  const { pages, dossier, agence } = result.data;
  const visibles = pages.filter(pagePourPdf);
  const accent = normaliserCouleurPrincipale(agence.couleurPrincipale);

  return (
    <div className="avis-print">
      <PrintStyles />
      <AvisPublicBarre pdfHref={`/api/avis/${encodeURIComponent(token)}/pdf`} />
      {visibles.map((page) => {
        if (page.kind === 'generee' && page.kindGeneree && dossier) {
          return (
            <PageGenereeHtml key={page.id} kind={page.kindGeneree} dossier={dossier} accent={accent} />
          );
        }
        return (
          <section key={page.id} className="avis-page">
            <header>
              <h1 className="avis-titre">{page.nom}</h1>
              <span className="avis-filet" aria-hidden />
            </header>
            <div className="avis-corps">
              {page.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={page.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <p className="avis-muted" style={{ margin: 0 }}>
                  {page.nom}
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
