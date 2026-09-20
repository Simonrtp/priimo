import type { ReactNode } from 'react';
import type { IdentiteAgenceRapport, IdentiteAgentRapport, PiedRapport } from '@/lib/rapport/identite';
import { construirePied, normaliserCouleurPrincipale, type PiedBienRapport } from '@/lib/rapport/identite';

/**
 * Gabarit unique de page paysage. En-tête logo, pied agent / bien / date / page.
 * Une donnée absente retire sa ligne — jamais de libellé orphelin.
 */
export default function PageRapport({
  agence,
  agent,
  bien,
  dateIso,
  page,
  pages,
  children,
}: {
  agence: IdentiteAgenceRapport;
  agent: IdentiteAgentRapport;
  bien: PiedBienRapport;
  dateIso?: string | null;
  page: number;
  pages: number;
  children?: ReactNode;
}) {
  const pied = construirePied({ agent, bien, dateIso, page, pages });
  const accent = normaliserCouleurPrincipale(agence.couleurPrincipale);
  return (
    <article
      className="relative flex aspect-[297/210] w-full flex-col overflow-hidden rounded-clay border border-black/[0.08] bg-white shadow-clay-sm"
      aria-label={`Page ${page} sur ${Math.max(pages, 1)}`}
    >
      <header className="flex h-10 shrink-0 items-center border-b border-black/[0.06] px-4">
        <span className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: accent }} aria-hidden />
        {agence.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={agence.logoUrl} alt="" className="h-7 max-w-[10rem] object-contain object-left" />
        ) : (
          <span className="truncate text-[12px] font-semibold text-text-strong">
            {agence.nomCommercial}
          </span>
        )}
      </header>
      <div className="min-h-0 flex-1 bg-[#F7F6F4]">{children}</div>
      <PiedRapportVue pied={pied} />
    </article>
  );
}

function PiedRapportVue({ pied }: { pied: PiedRapport }) {
  const droite = [pied.bien, pied.date, pied.page].filter(Boolean);
  if (!pied.agent && droite.length === 0) return null;
  return (
    <footer className="flex shrink-0 items-end justify-between gap-4 border-t border-black/[0.06] px-4 py-2">
      {pied.agent ? (
        <p className="min-w-0 truncate text-[11px] font-semibold text-text-strong">{pied.agent}</p>
      ) : (
        <span />
      )}
      {droite.length > 0 ? (
        <p className="min-w-0 text-right text-[11px] text-pretty text-text-muted">
          {droite.map((ligne) => (
            <span key={ligne} className="block tabular-nums">
              {ligne}
            </span>
          ))}
        </p>
      ) : null}
    </footer>
  );
}
