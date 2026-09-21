import ContenuPageModele from '@/components/rapport/ContenuPageModele';
import PageGeneree from '@/components/rapport/genere/PageGeneree';
import { estDisposition } from '@/lib/rapport/modele';
import type { DossierRapport } from '@/lib/rapport/genere/types';
import type { PageRapportComposee } from '@/lib/rapport/pages';

export default function ApercuPageComposee({
  page,
  accent,
  dossier,
}: {
  page: PageRapportComposee | null;
  accent: string;
  dossier?: DossierRapport | null;
}) {
  if (!page) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <p className="text-pretty text-center text-[13.5px] text-text-muted">
          Ajoutez une page pour voir l’aperçu.
        </p>
      </div>
    );
  }
  if (page.kind === 'generee' && page.kindGeneree && dossier) {
    if (page.manques.length > 0) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-8">
          <p className="text-[13.5px] font-semibold text-text-strong">Page incomplète</p>
          <p className="text-pretty text-center text-[13px] text-text-muted">
            {page.manques.join(' · ')}
          </p>
        </div>
      );
    }
    return <PageGeneree kind={page.kindGeneree} dossier={dossier} accent={accent} />;
  }
  if (page.kind === 'modele' && page.disposition && estDisposition(page.disposition)) {
    return (
      <ContenuPageModele
        disposition={page.disposition}
        contenu={page.contenu ?? {}}
        imageUrl={page.previewUrl}
        accent={accent}
      />
    );
  }
  if (page.kind === 'image' && page.previewUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={page.previewUrl} alt="" className="h-full w-full object-contain" />
    );
  }
  if (page.kind === 'pdf' && page.previewUrl) {
    return (
      <iframe
        title={page.nom}
        src={`${page.previewUrl}#page=${page.pageIndex + 1}&view=FitH`}
        className="h-full w-full border-0 bg-white"
      />
    );
  }
  return (
    <div className="flex h-full items-center justify-center px-6">
      <p className="text-pretty text-center text-[13.5px] text-text-muted">{page.nom}</p>
    </div>
  );
}
