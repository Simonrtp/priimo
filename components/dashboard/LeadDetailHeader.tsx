'use client';

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Building2, Home, ShieldCheck } from 'lucide-react';
import type { Lead } from '@/types/lead';
import { formatDate, formatPrice } from '@/lib/utils';
import { formatEtage } from '@/lib/lead-display';
import { hasDisplayableAcquiredPrice } from '@/lib/lead-valorisation';
import InfoTooltip from '@/components/ui/InfoTooltip';
import ScoreRing from './ScoreRing';

interface LeadDetailHeaderProps {
  lead: Pick<
    Lead,
    | 'address'
    | 'city'
    | 'postalCode'
    | 'propertyType'
    | 'surfaceM2'
    | 'etage'
    | 'acquiredYear'
    | 'acquiredPrice'
    | 'acquiredPriceReliable'
    | 'score'
    | 'marcheStatut'
    | 'marcheVerifieLe'
  >;
  /** id du titre — sert au `aria-labelledby` du drawer. */
  titleId?: string;
  /** Affichage compact de base (plein-écran mobile). */
  dense?: boolean;
  /** Conteneur scroll pour afficher la barre compacte. */
  scrollParentRef?: RefObject<HTMLElement | null>;
  /** Ancre visite guidée sur le badge Vérifié. */
  marketTourAnchor?: string;
  /** Padding horizontal (sur l’en-tête, pas sur le scroll parent). */
  padClassName?: string;
}

function joinDot(parts: (string | null | undefined)[]): ReactNode {
  const segments = parts.filter((p): p is string => Boolean(p));
  if (segments.length === 0) return null;
  return segments.map((segment, i) => (
    <span key={`${segment}-${i}`}>
      {i > 0 && <span className="mx-1.5 opacity-40">·</span>}
      {segment}
    </span>
  ));
}

/** Retire CP / ville déjà collés dans le champ adresse pour éviter les doublons. */
function streetOnly(
  address: string,
  postalCode?: string | null,
  city?: string | null,
): string {
  let street = address.trim();
  if (postalCode?.trim()) {
    const cp = postalCode.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    street = street.replace(new RegExp(`[,\\s]*${cp}\\b.*$`, 'i'), '').trim();
  }
  if (city?.trim()) {
    const c = city.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    street = street.replace(new RegExp(`[,\\s]*${c}\\s*$`, 'i'), '').trim();
  }
  street = street.replace(/,?\s*\d{5}(\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-']*)?\s*$/u, '').trim();
  return street || address.trim();
}

function cityLine(postalCode?: string | null, city?: string | null): string | null {
  const cp = postalCode?.trim() || '';
  const c = city?.trim() || '';
  if (cp && c) return `${cp} ${c}`;
  if (c) return c;
  if (cp) return cp;
  return null;
}

function acquiredLine(lead: LeadDetailHeaderProps['lead']): string | null {
  if (!hasDisplayableAcquiredPrice(lead) || lead.acquiredPrice == null) return null;
  const price = `${formatPrice(lead.acquiredPrice)} €`;
  const year = lead.acquiredYear != null && lead.acquiredYear > 0 ? lead.acquiredYear : null;
  if (year) return `Acquis en ${year} · ${price}`;
  return `Acquis ${price}`;
}

const SLATE = '#3D5A80';
const CREAM = '#FFF7F0';

/**
 * En-tête du détail lead :
 * 1) bloc complet en flux (défile) ;
 * 2) barre compacte sticky qui apparaît une fois le bloc hors écran.
 * Pas de changement de hauteur du sticky → pas de boucle de re-render.
 */
export default function LeadDetailHeader({
  lead,
  titleId,
  dense = false,
  scrollParentRef,
  marketTourAnchor,
  padClassName = '',
}: LeadDetailHeaderProps) {
  const [showCompactBar, setShowCompactBar] = useState(false);
  const fullHeaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = scrollParentRef?.current;
    const full = fullHeaderRef.current;
    if (!root || !full) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        // Barre compacte seulement quand l’en-tête complet a quitté le haut.
        const next = !entry.isIntersecting;
        setShowCompactBar((prev) => (prev === next ? prev : next));
      },
      { root, threshold: 0, rootMargin: '0px' },
    );
    io.observe(full);
    return () => io.disconnect();
  }, [scrollParentRef, lead.address]);

  const streetLine = streetOnly(lead.address, lead.postalCode, lead.city);
  const cityZipLine = cityLine(lead.postalCode, lead.city);
  const priceLine = acquiredLine(lead);
  const typeLine = joinDot([
    lead.propertyType,
    lead.surfaceM2 != null && lead.surfaceM2 > 0 ? `${lead.surfaceM2} m²` : null,
    formatEtage(lead.etage, lead.propertyType),
  ]);
  const TypeIcon = lead.propertyType === 'Maison' ? Home : lead.propertyType ? Building2 : null;

  const verified =
    lead.marcheStatut === 'hors_marche' && Boolean(lead.marcheVerifieLe?.trim());
  const verifiedTip = lead.marcheVerifieLe
    ? `Aucune annonce correspondante détectée au moment de la livraison, le ${formatDate(lead.marcheVerifieLe)}.`
    : '';

  const streetSize = dense ? 16 : 17;
  const metaSize = dense ? 12.5 : 13;
  const ringSize = dense ? 56 : 76;

  return (
    <>
      {/* En-tête complet : défile avec le contenu (pas sticky). */}
      <div
        ref={fullHeaderRef}
        className={`border-b border-black/[0.05] bg-white pt-4 pb-4 min-[400px]:pt-5 ${padClassName}`}
      >
        <div className="flex min-w-0 items-start justify-between gap-3 min-[400px]:gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <h2
              id={titleId}
              className="text-balance break-words font-semibold tracking-tight text-ink"
              style={{ fontSize: streetSize, letterSpacing: '-0.02em', lineHeight: 1.3 }}
            >
              {streetLine}
            </h2>
            {cityZipLine && (
              <p className="text-mute" style={{ fontSize: metaSize }}>
                {cityZipLine}
              </p>
            )}
            {typeLine && (
              <p
                className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-pretty text-mute"
                style={{ fontSize: metaSize }}
              >
                {TypeIcon && <TypeIcon size={13} strokeWidth={2} className="shrink-0" aria-hidden />}
                <span>{typeLine}</span>
              </p>
            )}
            {priceLine && (
              <p className="pt-1 font-medium tabular-nums text-ink" style={{ fontSize: metaSize }}>
                {priceLine}
              </p>
            )}
            {verified && (
              <div className="pt-2">
                <InfoTooltip content={verifiedTip} placement="top-start">
                  <span
                    data-tour={marketTourAnchor}
                    className="inline-flex w-fit max-w-full items-start gap-2 rounded-xl border px-2.5 py-2 text-left min-[400px]:items-center min-[400px]:px-3"
                    style={{
                      backgroundColor: CREAM,
                      borderColor: 'rgba(61,90,128,0.28)',
                      color: SLATE,
                    }}
                  >
                    <ShieldCheck size={16} strokeWidth={2.2} className="mt-0.5 shrink-0 min-[400px]:mt-0" aria-hidden />
                    <span className="text-pretty" style={{ fontSize: 12.5, fontWeight: 600 }}>
                      Absent des portails de vente
                    </span>
                  </span>
                </InfoTooltip>
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-center pt-0.5">
            <ScoreRing score={lead.score} size={ringSize} />
          </div>
        </div>
      </div>

      {/* Barre compacte : sticky, hauteur fixe — n’altère pas l’en-tête complet. */}
      <div
        className={`sticky top-0 z-20 overflow-hidden bg-white transition-[opacity,box-shadow] duration-fluid-subtle ease-in-out motion-reduce:transition-none ${padClassName} ${
          showCompactBar
            ? 'border-b border-black/[0.08] py-2.5 opacity-100 shadow-[0_4px_12px_rgba(10,13,17,0.06)]'
            : 'pointer-events-none h-0 border-transparent py-0 opacity-0'
        }`}
        aria-hidden={!showCompactBar}
      >
        {showCompactBar && (
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p
              className="min-w-0 truncate font-semibold tracking-tight text-ink"
              style={{ fontSize: 15, letterSpacing: '-0.02em' }}
            >
              {streetLine}
            </p>
            <ScoreRing score={lead.score} size={40} />
          </div>
        )}
      </div>
    </>
  );
}
