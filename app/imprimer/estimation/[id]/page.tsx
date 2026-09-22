import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth/getServerUser';
import { canSeeOwnedRecord, viewerFromProfile } from '@/lib/agency/visibility';
import { refuserSiEstimationFermee } from '@/lib/billing/exiger';
import { ESTIMATION_SELECT, mapEstimation } from '@/lib/estimation/objet';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { assemblerRapport } from '@/lib/rapport/genere/assembler';
import { pagePourPdf } from '@/lib/rapport/pages';
import { normaliserCouleurPrincipale } from '@/lib/rapport/identite';
import PageGenereeHtml from '@/components/rapport/print/PageGenereeHtml';
import { PrintStyles } from '@/components/rapport/print/Gabarit';
import BoutonImprimer from '@/components/rapport/print/BoutonImprimer';

export const dynamic = 'force-dynamic';

export default async function ImprimerAvisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, profile, agency } = await getServerUser();
  if (!user) redirect('/login');
  if (!profile || !agency) redirect('/api/auth/signout');
  if (refuserSiEstimationFermee(agency)) redirect('/dashboard');

  const session = await createSupabaseServerClient();
  const { data, error } = await session
    .from('agency_estimations')
    .select(ESTIMATION_SELECT)
    .eq('id', id)
    .eq('agency_id', agency.id)
    .maybeSingle();
  if (error || !data) redirect('/dashboard');

  const viewer = viewerFromProfile(profile);
  if (
    !canSeeOwnedRecord(viewer, {
      assignedTo: data.referent_id,
      createdBy: data.created_by,
    })
  ) {
    redirect('/dashboard');
  }

  const ctx = {
    user: { id: user.id, email: user.email ?? '' },
    profile,
    agency,
    estimation: mapEstimation(data),
  };

  let assemble;
  try {
    assemble = await assemblerRapport(session, ctx, { signer: false });
  } catch {
    redirect('/dashboard');
  }

  const pages = assemble.pages.filter(pagePourPdf);
  const accent = normaliserCouleurPrincipale(assemble.agence.couleurPrincipale);
  const dossier = assemble.dossier;

  return (
    <div className="avis-print">
      <PrintStyles />
      <BoutonImprimer />
      {pages.map((page) => {
        if (page.kind === 'generee' && page.kindGeneree && dossier) {
          return <PageGenereeHtml key={page.id} kind={page.kindGeneree} dossier={dossier} accent={accent} />;
        }
        return (
          <section key={page.id} className="avis-page">
            <header>
              <h1 className="avis-titre">{page.nom}</h1>
              <span className="avis-filet" aria-hidden />
            </header>
            <div className="avis-corps">
              {page.previewUrl && page.kind === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={page.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : page.previewUrl && page.kind === 'pdf' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={page.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <p className="avis-muted" style={{ margin: 0 }}>
                  Page de la bibliothèque — jointe automatiquement au PDF serveur.
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
