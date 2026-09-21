import ContenuPageModele from '@/components/rapport/ContenuPageModele';
import { estDisposition } from '@/lib/rapport/modele';
import type { PageRapportComposee } from '@/lib/rapport/pages';

export default function ApercuPageComposee({
  page,
  accent,
}: {
  page: PageRapportComposee | null;
  accent: string;
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
