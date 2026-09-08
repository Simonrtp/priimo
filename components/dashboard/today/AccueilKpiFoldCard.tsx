'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ACCUEIL, ACCUEIL_DARK, type AccueilAccent } from '@/lib/today/field';
import type { PortfolioCounter, PortfolioCounterKind } from '@/lib/today/portfolio';

const KPI_ACCENT: Record<PortfolioCounterKind, AccueilAccent> = {
  'mandats-actifs': 'vert',
  'leads-non-pris': 'jaune',
  'rdv-sans-suite': 'bleu',
  estimations: 'creme',
};

const KPI_GLYPH: Partial<Record<PortfolioCounterKind, { idle: string; lit: string }>> = {
  'mandats-actifs': {
    idle: encodeURI('/mandat-darret (1).png'),
    lit: '/mandat-darret.png',
  },
  'leads-non-pris': {
    idle: encodeURI('/attraction (1).png'),
    lit: '/attraction.png',
  },
  'rdv-sans-suite': {
    idle: encodeURI('/rendez-vous (1).png'),
    lit: '/rendez-vous.png',
  },
};

function KpiGlyph({ idle, lit }: { idle: string; lit: string }) {
  return (
    <span className="relative col-start-2 row-span-3 size-11 shrink-0 self-center md:size-14" aria-hidden>
      <img
        src={idle}
        alt=""
        width={56}
        height={56}
        draggable={false}
        className="absolute inset-0 size-full object-contain object-right opacity-100 transition-opacity duration-150 ease-out group-hover/kpi:opacity-0 group-focus-within/kpi:opacity-0 motion-reduce:transition-none"
      />
      <img
        src={lit}
        alt=""
        width={56}
        height={56}
        draggable={false}
        className="absolute inset-0 size-full object-contain object-right opacity-0 transition-opacity duration-150 ease-out group-hover/kpi:opacity-100 group-focus-within/kpi:opacity-100 motion-reduce:transition-none"
      />
    </span>
  );
}

/**
 * Compteur portefeuille. Au repos : chiffre + titre + tendance, hauteur fixe.
 * Au survol (desktop), la carte se déplie par-dessus la grille et découvre le
 * détail plus le bouton — seule zone cliquable.
 */
export default function AccueilKpiFoldCard({ item }: { item: PortfolioCounter }) {
  const accent = KPI_ACCENT[item.kind];
  const glyph = KPI_GLYPH[item.kind];

  return (
    <div className="relative md:h-[124px]">
      <article
        className="group/kpi flex h-full flex-col rounded-[18px] p-4 text-ink md:absolute md:inset-x-0 md:top-0 md:h-auto md:min-h-full md:hover:z-30 md:focus-within:z-30"
        style={{ backgroundColor: ACCUEIL[accent] }}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2">
          <p className="tabular-nums text-[27px] font-semibold leading-none">{item.value}</p>
          {glyph ? <KpiGlyph idle={glyph.idle} lit={glyph.lit} /> : null}
          <p className="mt-2 line-clamp-2 min-h-[2.1rem] text-[13px] font-medium leading-[1.3]">
            {item.label}
          </p>
          <p className="col-start-1 mt-0.5 line-clamp-1 min-h-[15px] text-[11px] leading-[15px] text-ink/60">
            {item.deltaLabel ?? '\u00a0'}
          </p>
        </div>

        <div className="grid grid-rows-[1fr] transition-[grid-template-rows] duration-fluid ease-out motion-reduce:transition-none md:grid-rows-[0fr] md:group-hover/kpi:grid-rows-[1fr] md:group-focus-within/kpi:grid-rows-[1fr]">
          <div className="overflow-hidden">
            {item.subtitle ? (
              <p className="pt-2 text-pretty text-[11.5px] leading-snug text-ink/70">{item.subtitle}</p>
            ) : null}
            <Link
              href={item.href}
              className="mt-3 inline-flex min-h-[32px] items-center gap-1 rounded-[10px] px-3 text-[12px] font-semibold text-ink transition-opacity duration-150 ease-out hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink/40 motion-reduce:transition-none"
              style={{ backgroundColor: ACCUEIL_DARK[accent] }}
            >
              Voir
              <ChevronRight size={14} strokeWidth={2.5} aria-hidden />
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}
