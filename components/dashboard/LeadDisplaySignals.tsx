'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
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
      <span aria-hidden className="text-mute/60" style={{ fontSize: 10 }}>
        •
      </span>
      <span className="min-w-0 flex-1">{item.label}</span>
      {item.tooltip && (
        <InfoTooltip content={item.tooltip} placement="top-end" iconSize={12} className="ml-0.5" />
      )}
    </li>
  );
}

function SignalFamilyDisclosure({
  title,
  tooltip,
  children,
}: {
  title: React.ReactNode;
  tooltip?: string | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="py-2">
      <div className="flex items-start gap-2">
        <p
          className="min-w-0 flex-1 font-semibold leading-snug text-ink"
          style={{ fontSize: 13 }}
        >
          {title}
        </p>
        {tooltip && (
          <span className="flex-shrink-0 pt-0.5">
            <InfoTooltip content={tooltip} placement="top-end" iconSize={13} />
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? 'Replier les détails' : 'Afficher les détails'}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-mute transition-colors duration-150 hover:bg-black/[0.04] hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
        >
          <ChevronDown
            size={16}
            strokeWidth={2.25}
            className={`transition-transform duration-150 ease-out ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
      </div>

      <div id={panelId} hidden={!open} className="mt-2 pl-1">
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
    <SignalFamilyDisclosure title={title}>
      {family.items.length > 0 ? (
        <ul className="space-y-1 pl-3">
          {family.items.map((item, i) => (
            <ItemLine key={`dpe-${i}`} item={item} />
          ))}
        </ul>
      ) : (
        <p className="pl-3 text-mute" style={{ fontSize: 12.5 }}>
          Aucun détail supplémentaire.
        </p>
      )}
    </SignalFamilyDisclosure>
  );
}

function CascadePanel({ family }: { family: CascadeDisplayFamily }) {
  const headParts: string[] = ['Cascade de vente'];
  if (family.nbVentes != null) {
    const word = family.nbVentes > 1 ? 'ventes' : 'vente';
    headParts.push(`${family.nbVentes} ${word} dans l’immeuble`);
  }

  return (
    <SignalFamilyDisclosure title={headParts.join(' — ')} tooltip={family.tooltip}>
      {family.dates.length > 0 ? (
        <ul className="pl-3">
          <li
            className="flex items-baseline gap-1.5 text-ink"
            style={{ fontSize: 12.5, lineHeight: 1.5 }}
          >
            <span aria-hidden className="text-mute/60" style={{ fontSize: 10 }}>
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
        <p className="pl-3 text-mute" style={{ fontSize: 12.5 }}>
          Aucune date disponible.
        </p>
      )}
    </SignalFamilyDisclosure>
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
    <SignalFamilyDisclosure title={title} tooltip={family.tooltip}>
      <ul className="space-y-1 pl-3">
        {family.items.map((item, i) => (
          <ItemLine key={`${title}-${i}`} item={item} />
        ))}
      </ul>
    </SignalFamilyDisclosure>
  );
}

/**
 * Familles de `display_signals` — lignes de texte + bouton pour déplier.
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
    <div>
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
