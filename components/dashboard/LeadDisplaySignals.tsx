'use client';

import { useId, useState } from 'react';
import InfoTooltip from '@/components/ui/InfoTooltip';
import {
  formatDpeAgeLabel,
  formatDpeDateForDisplay,
  isDisplaySignalsEmpty,
  type CascadeDisplayFamily,
  type CoproprieteDisplayFamily,
  type DisplayItem,
  type DisplaySignals,
  type DpeDisplayFamily,
  type EvenementsVieDisplayFamily,
} from '@/lib/display-signals';

interface LeadDisplaySignalsProps {
  displaySignals: DisplaySignals;
}

function ItemLine({ item }: { item: DisplayItem }) {
  return (
    <li
      className="flex items-baseline gap-1.5 text-ink"
      style={{ fontSize: 12.5, lineHeight: 1.5 }}
    >
      <span aria-hidden className="text-mute/70" style={{ fontSize: 10 }}>
        •
      </span>
      <span className="min-w-0 flex-1">{item.label}</span>
      {item.tooltip && (
        <InfoTooltip content={item.tooltip} placement="top-end" iconSize={12} className="ml-1" />
      )}
    </li>
  );
}

function SignalFamilyAccordion({
  title,
  tooltip,
  children,
  defaultOpen = false,
}: {
  title: React.ReactNode;
  tooltip?: string | null;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-baseline gap-1.5 py-1 text-left font-semibold text-ink transition-colors hover:text-accent-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:ring-offset-1"
        style={{ fontSize: 13, lineHeight: 1.4 }}
      >
        <span
          aria-hidden
          className="inline-block flex-shrink-0 text-accent transition-transform duration-150 ease-out"
          style={{
            fontSize: 11,
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          ▸
        </span>
        <span className="min-w-0 flex-1">{title}</span>
        {tooltip && (
          <span
            className="ml-1 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <InfoTooltip content={tooltip} placement="top-end" iconSize={13} />
          </span>
        )}
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="mt-1.5 pl-4"
      >
        {children}
      </div>
    </div>
  );
}

function DpePanel({ family }: { family: DpeDisplayFamily }) {
  const date = formatDpeDateForDisplay(family.date);
  const age = formatDpeAgeLabel(family.ageJours);
  const parts: string[] = [];
  if (family.classe) parts.push(`DPE ${family.classe}`);
  else parts.push('DPE');
  if (date) parts.push(`fait le ${date}`);

  const title = (
    <>
      {parts.join(' — ')}
      {age && <span className="font-normal text-mute"> ({age})</span>}
    </>
  );

  return (
    <SignalFamilyAccordion title={title} defaultOpen>
      {family.items.length > 0 ? (
        <ul className="space-y-1">
          {family.items.map((item, i) => (
            <ItemLine key={`dpe-${i}`} item={item} />
          ))}
        </ul>
      ) : (
        <p className="text-mute" style={{ fontSize: 12.5 }}>
          Aucun détail supplémentaire.
        </p>
      )}
    </SignalFamilyAccordion>
  );
}

function CascadePanel({ family }: { family: CascadeDisplayFamily }) {
  const headParts: string[] = ['Cascade de vente'];
  if (family.nbVentes != null) {
    const word = family.nbVentes > 1 ? 'ventes' : 'vente';
    headParts.push(`${family.nbVentes} ${word} dans l’immeuble`);
  }

  return (
    <SignalFamilyAccordion title={headParts.join(' — ')} tooltip={family.tooltip} defaultOpen>
      {family.dates.length > 0 ? (
        <ul>
          <li
            className="flex items-baseline gap-1.5 text-ink"
            style={{ fontSize: 12.5, lineHeight: 1.5 }}
          >
            <span aria-hidden className="text-mute/70" style={{ fontSize: 10 }}>
              •
            </span>
            <span className="min-w-0 flex-1 tabular">
              {family.dates.map((d, i) => (
                <span key={`${d}-${i}`}>
                  {i > 0 && <span className="mx-1 opacity-50">·</span>}
                  {d}
                </span>
              ))}
            </span>
          </li>
        </ul>
      ) : (
        <p className="text-mute" style={{ fontSize: 12.5 }}>
          Aucune date disponible.
        </p>
      )}
    </SignalFamilyAccordion>
  );
}

function ItemsFamilyPanel({
  title,
  family,
}: {
  title: string;
  family: CoproprieteDisplayFamily | EvenementsVieDisplayFamily;
}) {
  return (
    <SignalFamilyAccordion title={title} tooltip={family.tooltip} defaultOpen>
      <ul className="space-y-1">
        {family.items.map((item, i) => (
          <ItemLine key={`${title}-${i}`} item={item} />
        ))}
      </ul>
    </SignalFamilyAccordion>
  );
}

/**
 * Familles de `display_signals` en volets dépliables (accordéon).
 * Lignes épurées, sans cartes ni points de scoring.
 */
export default function LeadDisplaySignals({ displaySignals }: LeadDisplaySignalsProps) {
  if (isDisplaySignalsEmpty(displaySignals)) {
    return (
      <p className="text-mute" style={{ fontSize: 12.5 }}>
        Aucun signal détecté
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {displaySignals.dpe && <DpePanel family={displaySignals.dpe} />}
      {displaySignals.cascade && <CascadePanel family={displaySignals.cascade} />}
      {displaySignals.copropriete && (
        <ItemsFamilyPanel title="Copropriété" family={displaySignals.copropriete} />
      )}
      {displaySignals.evenementsVie && (
        <ItemsFamilyPanel title="Événements de vie" family={displaySignals.evenementsVie} />
      )}
    </div>
  );
}
