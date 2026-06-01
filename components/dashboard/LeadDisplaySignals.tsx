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

function FamilyHead({
  children,
  tooltip,
}: {
  children: React.ReactNode;
  tooltip?: string | null;
}) {
  return (
    <p
      className="flex items-baseline gap-1.5 font-semibold text-ink"
      style={{ fontSize: 13, lineHeight: 1.4 }}
    >
      <span aria-hidden className="text-accent-dark opacity-80">
        ▸
      </span>
      <span className="min-w-0 flex-1">{children}</span>
      {tooltip && (
        <InfoTooltip content={tooltip} placement="top-end" iconSize={13} className="ml-1" />
      )}
    </p>
  );
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

function DpeBlock({ family }: { family: DpeDisplayFamily }) {
  const date = formatDpeDateForDisplay(family.date);
  const age = formatDpeAgeLabel(family.ageJours);
  const parts: string[] = [];
  if (family.classe) parts.push(`DPE ${family.classe}`);
  else parts.push('DPE');
  if (date) parts.push(`fait le ${date}`);
  const head = parts.join(' — ');
  return (
    <div>
      <FamilyHead>
        {head}
        {age && <span className="ml-1 font-normal text-mute"> ({age})</span>}
      </FamilyHead>
      {family.items.length > 0 && (
        <ul className="mt-1.5 space-y-1 pl-4">
          {family.items.map((item, i) => (
            <ItemLine key={`dpe-${i}`} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CascadeBlock({ family }: { family: CascadeDisplayFamily }) {
  const headParts: string[] = ['Cascade de vente'];
  if (family.nbVentes != null) {
    const word = family.nbVentes > 1 ? 'ventes' : 'vente';
    headParts.push(`${family.nbVentes} ${word} dans l’immeuble`);
  }
  return (
    <div>
      <FamilyHead tooltip={family.tooltip}>{headParts.join(' — ')}</FamilyHead>
      {family.dates.length > 0 && (
        <ul className="mt-1.5 pl-4">
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
      )}
    </div>
  );
}

function ItemsFamilyBlock({
  title,
  family,
}: {
  title: string;
  family: CoproprieteDisplayFamily | EvenementsVieDisplayFamily;
}) {
  return (
    <div>
      <FamilyHead tooltip={family.tooltip}>{title}</FamilyHead>
      {family.items.length > 0 && (
        <ul className="mt-1.5 space-y-1 pl-4">
          {family.items.map((item, i) => (
            <ItemLine key={`${title}-${i}`} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Restitue les familles de `display_signals` en lignes épurées.
 * Aucune carte encadrée, aucun nombre de points : seuls les libellés
 * et tooltips fournis par le pipeline sont affichés.
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
    <div className="space-y-4">
      {displaySignals.dpe && <DpeBlock family={displaySignals.dpe} />}
      {displaySignals.cascade && <CascadeBlock family={displaySignals.cascade} />}
      {displaySignals.copropriete && (
        <ItemsFamilyBlock title="Copropriété" family={displaySignals.copropriete} />
      )}
      {displaySignals.evenementsVie && (
        <ItemsFamilyBlock title="Événements de vie" family={displaySignals.evenementsVie} />
      )}
    </div>
  );
}
