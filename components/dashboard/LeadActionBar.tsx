'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { MapPin, Phone } from 'lucide-react';
import type { Lead } from '@/types/lead';
import { formatLeadAddressQuery, googleMapsSearchUrl } from '@/lib/utils';
import { collectLeadCallTargets } from '@/lib/lead-person-display';
import { useOutsideDismiss } from '@/lib/hooks/useOutsideDismiss';

type LeadActionBarProps = {
  lead: Lead;
  /** Classes de densité (mobile vs desktop). */
  dense?: boolean;
};

/**
 * Barre d’action collante : Itinéraire + Appeler (si numéro).
 */
export default function LeadActionBar({ lead, dense = false }: LeadActionBarProps) {
  const mapsHref = googleMapsSearchUrl(formatLeadAddressQuery(lead));
  const targets = collectLeadCallTargets(lead);
  const hasPhone = targets.length > 0;
  const multi = targets.length > 1;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useOutsideDismiss(menuOpen, closeMenu, wrapRef);

  useEffect(() => {
    setMenuOpen(false);
  }, [lead.id]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const btnH = dense ? 'min-h-[50px]' : 'min-h-[44px]';
  const btnBase = `inline-flex ${btnH} flex-1 items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30`;
  const btnSize = dense ? 15 : 14;

  const mapsBtn = (
    <a
      href={mapsHref}
      target="_blank"
      rel="noopener noreferrer"
      className={`${btnBase} border border-black/[0.12] bg-white text-[#3D5A80] hover:border-black/[0.18] hover:bg-black/[0.02] ${
        hasPhone ? 'min-w-0' : 'w-full'
      }`}
      style={{ fontSize: btnSize }}
      onClick={(e) => e.stopPropagation()}
    >
      <MapPin size={18} strokeWidth={2.2} className="shrink-0" aria-hidden />
      <span className="truncate">Itinéraire</span>
    </a>
  );

  const tagFor = (target: (typeof targets)[number]): string | undefined => target.tag;

  return (
    <div
      className="flex min-w-0 flex-shrink-0 items-stretch gap-2 border-t border-black/[0.08] bg-white pt-3 min-[400px]:gap-2.5"
      style={{ paddingBottom: dense ? 'max(12px, env(safe-area-inset-bottom))' : 12 }}
    >
      {mapsBtn}

      {hasPhone && !multi && (
        <a
          href={`tel:${targets[0].phone}`}
          className={`${btnBase} min-w-0 bg-[#E8743C] text-white hover:bg-[#C25E2C]`}
          style={{ fontSize: btnSize }}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Appeler ${targets[0].label}`}
        >
          <Phone size={18} strokeWidth={2.2} className="shrink-0" aria-hidden />
          <span className="truncate">Appeler</span>
        </a>
      )}

      {hasPhone && multi && (
        <div ref={wrapRef} className="relative min-w-0 flex-1">
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-haspopup="menu"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className={`${btnBase} w-full bg-[#E8743C] text-white hover:bg-[#C25E2C]`}
            style={{ fontSize: btnSize }}
          >
            <Phone size={18} strokeWidth={2.2} className="shrink-0" aria-hidden />
            <span className="truncate">Appeler</span>
          </button>
          {menuOpen && (
            <ul
              id={menuId}
              role="menu"
              className="absolute bottom-full left-0 right-0 z-30 mb-2 max-h-[50dvh] overflow-y-auto overscroll-contain rounded-xl border border-black/[0.08] bg-white py-1 shadow-lg"
            >
              {targets.map((t, i) => {
                const tag = tagFor(t);
                return (
                  <li key={`${t.phone}-${i}`} role="none">
                    <a
                      role="menuitem"
                      href={`tel:${t.phone}`}
                      className="flex min-h-12 flex-col justify-center px-3.5 py-2.5 text-left transition-colors hover:bg-black/[0.03] focus:outline-none focus-visible:bg-black/[0.04]"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                      }}
                    >
                      <span className="break-words font-medium text-ink" style={{ fontSize: 13 }}>
                        {t.label}
                        {tag ? (
                          <span className="ml-1.5 font-normal text-mute" style={{ fontSize: 12 }}>
                            · {tag}
                          </span>
                        ) : null}
                      </span>
                      <span className="tabular-nums text-[#3D5A80]" style={{ fontSize: 12.5 }}>
                        {t.phone}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
