import Image from 'next/image';
import type { ReactNode } from 'react';

/** Même couple pastel que les boutons KPI de l’Accueil. */
export const BOUTON_CARTE_VIDE =
  'inline-flex min-h-[42px] items-center justify-center rounded-clay bg-[#D4E8F5] px-5 text-[14px] font-semibold text-ink shadow-clay-sm transition-[background-color,transform,box-shadow] duration-fluid-subtle ease-in-out hover:-translate-y-0.5 hover:bg-[#A8CCE6] hover:shadow-clay active:translate-y-0 active:shadow-clay-pressed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A8CCE6]';

/**
 * État vide de l’Accueil : un titre, une accroche, trois gestes, une icône
 * à droite. Les PNG sont noirs ; on les laisse gris, pas silhouette.
 */
export default function CarteVideAccueil({
  titre,
  accroche,
  etapes,
  action,
  icone,
  className = '',
}: {
  titre: string;
  accroche: string;
  etapes?: readonly string[];
  action?: ReactNode;
  icone: string;
  className?: string;
}) {
  return (
    <section
      className={`flex h-full min-w-0 items-center gap-6 rounded-clay-lg bg-white p-5 shadow-clay ${className}`.trim()}
    >
      <div className="min-w-0 flex-1">
        <h2 className="text-balance font-semibold text-ink" style={{ fontSize: 16 }}>
          {titre}
        </h2>
        <p className="mt-3 text-balance text-[15px] font-semibold text-ink">{accroche}</p>
        {etapes && etapes.length > 0 ? (
          <ol className="mt-4 flex flex-col gap-2">
            {etapes.map((etape, i) => (
              <li key={etape} className="flex items-start gap-2.5 text-[13px] text-ink">
                <span
                  aria-hidden
                  className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-[11px] font-semibold tabular-nums text-mute"
                >
                  {i + 1}
                </span>
                <span className="text-pretty">{etape}</span>
              </li>
            ))}
          </ol>
        ) : null}
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
      <Image
        src={icone}
        alt=""
        width={152}
        height={152}
        aria-hidden
        className="mr-3 hidden shrink-0 opacity-[0.38] sm:block"
      />
    </section>
  );
}
