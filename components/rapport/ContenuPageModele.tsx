import type { DispositionPageAgence } from '@/types/database';
import { visuelPage, type ContenuPageModele as Contenu } from '@/lib/rapport/modele';
import { corpsVersHtml } from '@/lib/rapport/texte-riche';

export default function ContenuPageModele({
  disposition,
  contenu,
  imageUrl,
  accent,
}: {
  disposition: DispositionPageAgence;
  contenu: Contenu;
  imageUrl?: string | null;
  accent: string;
}) {
  const visuel = visuelPage(contenu);
  const html = visuel.corps.length > 0 ? corpsVersHtml(visuel.corps) : '';
  const hasImage = Boolean(imageUrl);

  if (disposition === 'image') {
    return (
      <div className="relative h-full w-full bg-[#EDEBE8]">
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl!} alt="" className="absolute inset-0 size-full object-cover" />
        ) : null}
        {visuel.titre ? (
          <div className="absolute inset-x-0 top-0 bg-white/90 px-5 py-3">
            <h2 className="text-balance text-[15px] font-semibold text-text-strong">{visuel.titre}</h2>
            <span className="mt-1.5 block h-0.5 w-10" style={{ backgroundColor: accent }} aria-hidden />
          </div>
        ) : null}
      </div>
    );
  }

  if (disposition === 'points') {
    return (
      <div className="flex h-full flex-col gap-3 px-5 py-4">
        {visuel.titre ? <TitrePage titre={visuel.titre} accent={accent} /> : null}
        {visuel.points.length > 0 ? (
          <ul
            className={`grid min-h-0 flex-1 gap-3 ${visuel.points.length <= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}
          >
            {visuel.points.map((point, i) => (
              <li key={`${point.intitule ?? ''}-${i}`} className="flex min-h-0 gap-2.5">
                <span className="mt-0.5 w-0.5 shrink-0 self-stretch rounded-full" style={{ backgroundColor: accent }} aria-hidden />
                <div className="min-w-0">
                  {point.intitule ? (
                    <p className="text-balance text-[13px] font-semibold text-text-strong">{point.intitule}</p>
                  ) : null}
                  {point.description ? (
                    <p className="mt-0.5 text-pretty text-[12px] text-text-muted">{point.description}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  const texte = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2.5">
      {visuel.titre ? <TitrePage titre={visuel.titre} accent={accent} /> : null}
      {html ? (
        <div
          className="min-h-0 flex-1 overflow-hidden text-pretty text-[12.5px] leading-relaxed text-text [&_em]:italic [&_li]:mb-1 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-4"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : null}
    </div>
  );

  if (disposition === 'texte_image' && hasImage) {
    const image = (
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-md bg-[#EDEBE8]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl!} alt="" className="size-full object-cover" />
      </div>
    );
    return (
      <div className="flex h-full gap-4 px-5 py-4">
        {visuel.imageCote === 'gauche' ? image : null}
        {texte}
        {visuel.imageCote === 'droite' ? image : null}
      </div>
    );
  }

  return <div className="flex h-full flex-col px-5 py-4">{texte}</div>;
}

function TitrePage({ titre, accent }: { titre: string; accent: string }) {
  return (
    <div>
      <h2 className="text-balance text-[16px] font-semibold text-text-strong">{titre}</h2>
      <span className="mt-1.5 block h-0.5 w-10" style={{ backgroundColor: accent }} aria-hidden />
    </div>
  );
}
