'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';
import {
  entrepriseDetailItems,
  formatDpeAgeLabel,
  formatDpeDateForDisplay,
  getDisplaySections,
  isDisplaySignalsEmpty,
  resolveDpeAgeJours,
  type CascadeDisplayFamily,
  type DisplayItem,
  type DisplaySection,
  type DisplaySignals,
  type DpeDisplayFamily,
  type EntrepriseDisplayFamily,
  type EvenementsVieDisplayFamily,
} from '@/lib/display-signals';
import {
  EVENEMENTS_VIE_SECTION_INTRO,
  EVENEMENTS_VIE_SECTION_TITLE,
  EVENEMENTS_VIE_SECTION_TOOLTIP,
  reformulateEvenementsVieFamily,
} from '@/lib/evenements-vie-display';

interface LeadDisplaySignalsProps {
  displaySignals: DisplaySignals;
  /** Date DPE canonique (colonne leads.dpe_date) — prioritaire pour l'âge relatif. */
  dpeDate?: string | null;
}

type ItemsFamily = {
  items: DisplayItem[];
  tooltip: string | null;
};

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

function ItemsList({ items }: { items: DisplayItem[] }) {
  if (items.length === 0) {
    return (
      <p className="pl-3 text-mute" style={{ fontSize: 12.5 }}>
        Aucun détail supplémentaire.
      </p>
    );
  }
  return (
    <ul className="space-y-1 pl-3">
      {items.map((item, i) => (
        <ItemLine key={i} item={item} />
      ))}
    </ul>
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

  const toggle = () => setOpen((v) => !v);

  return (
    <div className="py-2">
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full cursor-pointer items-start gap-2 rounded-md py-0.5 text-left transition-colors duration-150 hover:text-accent-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:ring-offset-1"
      >
        <span
          className="min-w-0 flex-1 font-semibold leading-snug text-ink"
          style={{ fontSize: 13 }}
        >
          {title}
        </span>
        {tooltip && (
          <span
            className="flex-shrink-0 pt-0.5"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <InfoTooltip content={tooltip} placement="top-end" iconSize={13} />
          </span>
        )}
        <span
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center text-mute"
          aria-hidden
        >
          <ChevronDown
            size={16}
            strokeWidth={2.25}
            className={`transition-transform duration-150 ease-out ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </div>

      <div id={panelId} hidden={!open} className="mt-2 pl-1">
        {children}
      </div>
    </div>
  );
}

function DpePanel({ family, dpeDate }: { family: DpeDisplayFamily; dpeDate: string | null }) {
  const dateRaw = dpeDate ?? family.date;
  const date = formatDpeDateForDisplay(dateRaw);
  const age = formatDpeAgeLabel(resolveDpeAgeJours(family, dpeDate));
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
      <ItemsList items={family.items} />
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

function ItemsFamilyPanel({ title, family }: { title: string; family: ItemsFamily }) {
  return (
    <SignalFamilyDisclosure title={title} tooltip={family.tooltip}>
      <ItemsList items={family.items} />
    </SignalFamilyDisclosure>
  );
}

function EntreprisePanel({ family }: { family: EntrepriseDisplayFamily }) {
  const date = formatDpeDateForDisplay(family.eventDate);
  const headline =
    family.eventType ?? family.items[0]?.label ?? 'Événement société';
  const detailItems = entrepriseDetailItems(family);

  const title = (
    <>
      {headline}
      {date && <span className="font-normal text-mute"> — {date}</span>}
      {family.siren && (
        <span className="font-normal text-mute"> · SIREN {family.siren}</span>
      )}
    </>
  );

  return (
    <SignalFamilyDisclosure title={title}>
      <ItemsList items={detailItems} />
    </SignalFamilyDisclosure>
  );
}

function EvenementsViePanel({ family }: { family: EvenementsVieDisplayFamily }) {
  const display = reformulateEvenementsVieFamily(family);

  return (
    <SignalFamilyDisclosure
      title={display.label ?? EVENEMENTS_VIE_SECTION_TITLE}
      tooltip={display.tooltip ?? EVENEMENTS_VIE_SECTION_TOOLTIP}
    >
      <p className="mb-2 pl-3 text-pretty text-mute" style={{ fontSize: 12, lineHeight: 1.55 }}>
        {EVENEMENTS_VIE_SECTION_INTRO}
      </p>
      <ItemsList items={display.items} />
    </SignalFamilyDisclosure>
  );
}

function DisplaySectionView({
  section,
  dpeDate,
}: {
  section: DisplaySection;
  dpeDate: string | null;
}) {
  switch (section.kind) {
    case 'dpe':
      return <DpePanel family={section.family} dpeDate={dpeDate} />;
    case 'cascade':
      return <CascadePanel family={section.family} />;
    case 'copropriete':
      return <ItemsFamilyPanel title="Copropriété" family={section.family} />;
    case 'evenements_vie':
      return <EvenementsViePanel family={section.family} />;
    case 'entreprise':
      return <EntreprisePanel family={section.family} />;
    case 'generic':
      return <ItemsFamilyPanel title={section.family.title} family={section.family} />;
    default:
      return null;
  }
}

/**
 * Familles de `display_signals` — lignes de texte + accordéon.
 * Tous fermés par défaut à l'ouverture du lead.
 */
export default function LeadDisplaySignals({
  displaySignals,
  dpeDate = null,
}: LeadDisplaySignalsProps) {
  if (isDisplaySignalsEmpty(displaySignals)) {
    return (
      <p className="text-mute" style={{ fontSize: 12.5 }}>
        Aucun signal détecté
      </p>
    );
  }

  const sections = getDisplaySections(displaySignals);

  return (
    <div>
      {sections.map((section) => (
        <DisplaySectionView
          key={
            section.kind === 'generic'
              ? `generic-${section.family.key}`
              : section.kind
          }
          section={section}
          dpeDate={dpeDate}
        />
      ))}
    </div>
  );
}
