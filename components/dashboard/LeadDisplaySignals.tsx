'use client';

import { useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';
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
    <li className="flex items-baseline gap-2 py-0.5 text-ink" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
      <span
        aria-hidden
        className="mt-[0.35em] h-1 w-1 flex-shrink-0 rounded-full bg-mute/40"
      />
      <span className="min-w-0 flex-1">{item.label}</span>
      {item.tooltip && (
        <InfoTooltip content={item.tooltip} placement="top-end" iconSize={12} className="ml-0.5" />
      )}
    </li>
  );
}

function SignalFamilyAccordion({
  title,
  tooltip,
  children,
  emphasized = false,
}: {
  title: React.ReactNode;
  tooltip?: string | null;
  children: React.ReactNode;
  /** Mise en avant légère (ex. cascade). */
  emphasized?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div
      className={`overflow-hidden rounded-xl border transition-colors duration-150 ${
        open
          ? 'border-black/[0.08] bg-white shadow-soft'
          : emphasized
            ? 'border-accent/20 bg-soft-warm/60'
            : 'border-black/[0.06] bg-[#FAFAF7]'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:ring-offset-1 ${
          open ? 'bg-black/[0.015]' : 'hover:bg-black/[0.03]'
        }`}
      >
        <span
          aria-hidden
          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md transition-colors duration-150 ${
            open ? 'bg-accent/15 text-accent' : 'bg-black/[0.05] text-mute'
          }`}
        >
          <ChevronRight
            size={14}
            strokeWidth={2.25}
            className={`transition-transform duration-150 ease-out ${open ? 'rotate-90' : ''}`}
          />
        </span>
        <span
          className={`min-w-0 flex-1 leading-snug ${open ? 'font-semibold text-ink' : 'font-medium text-ink'}`}
          style={{ fontSize: 13 }}
        >
          {title}
        </span>
        {tooltip && (
          <span
            className="flex-shrink-0"
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
        className="border-t border-black/[0.05] px-3 pb-3 pt-2"
      >
        <div className="border-l-2 border-accent/25 pl-3">{children}</div>
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
    <SignalFamilyAccordion title={title}>
      {family.items.length > 0 ? (
        <ul className="space-y-0.5">
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
    <SignalFamilyAccordion title={headParts.join(' — ')} tooltip={family.tooltip} emphasized>
      {family.dates.length > 0 ? (
        <ul>
          <li
            className="flex items-baseline gap-2 py-0.5 text-ink"
            style={{ fontSize: 12.5, lineHeight: 1.5 }}
          >
            <span
              aria-hidden
              className="mt-[0.35em] h-1 w-1 flex-shrink-0 rounded-full bg-mute/40"
            />
            <span className="min-w-0 flex-1 tabular">
              {family.dates.map((d, i) => (
                <span key={`${d}-${i}`}>
                  {i > 0 && <span className="mx-1.5 text-mute/50">·</span>}
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
    <SignalFamilyAccordion title={title} tooltip={family.tooltip}>
      <ul className="space-y-0.5">
        {family.items.map((item, i) => (
          <ItemLine key={`${title}-${i}`} item={item} />
        ))}
      </ul>
    </SignalFamilyAccordion>
  );
}

/**
 * Familles de `display_signals` en volets dépliables.
 * Tous fermés par défaut à l'ouverture du lead.
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
    <div className="flex flex-col gap-2">
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
