'use client';

import {
  Building2,
  DoorOpen,
  FileSearch,
  MessageSquareQuote,
  PhoneCall,
  type LucideIcon,
} from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';
import { COULEUR_FAMILLE } from '@/lib/activite/couleurs';
import {
  PHRASE_ETAT_SOURCE,
  type Compteur,
  type FamilleActivite,
} from '@/lib/activite/types';

const ICONE: Record<FamilleActivite, LucideIcon> = {
  contacts_physiques: DoorOpen,
  immeubles_prospectes: Building2,
  contacts_qualifies: PhoneCall,
  estimations: FileSearch,
  informations_terrain: MessageSquareQuote,
};

function ecartLisible(ecart: number): string {
  if (ecart === 0) return 'stable';
  return `${ecart > 0 ? '+' : '−'}${Math.abs(ecart)}`;
}

function CarteCompteur({ compteur, misEnAvant }: { compteur: Compteur; misEnAvant: boolean }) {
  const famille = compteur.activite as FamilleActivite;
  const { teinte, pastille } = COULEUR_FAMILLE[famille];
  const Icone = ICONE[famille];
  const muet = compteur.etatSource !== 'ok';
  const pct =
    compteur.objectif > 0
      ? Math.min(100, Math.round((compteur.valeur / compteur.objectif) * 100))
      : 0;

  return (
    <li
      className="flex min-w-0 flex-col rounded-clay-lg bg-surface p-4 shadow-clay-sm transition-shadow duration-fluid-subtle"
      style={misEnAvant ? { boxShadow: `0 0 0 2px ${teinte}`, borderRadius: 24 } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
          style={{ backgroundColor: pastille, color: teinte }}
        >
          <Icone size={17} strokeWidth={2.2} />
        </span>
        <InfoTooltip content={compteur.provenance} placement="top-end" iconSize={13} />
      </div>

      <p className="mt-3 text-[12px] font-semibold leading-tight text-text-muted">
        {compteur.libelle}
      </p>

      {muet ? (
        <>
          <p className="mt-2 text-[13px] leading-snug text-text-subtle">
            {PHRASE_ETAT_SOURCE[compteur.etatSource as 'muette' | 'indisponible']}
          </p>
          <div className="mt-auto pt-3" />
        </>
      ) : (
        <>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="font-display text-[26px] font-bold leading-none text-text-strong">
              {compteur.valeur.toLocaleString('fr-FR')}
            </span>
            <span className="text-[13px] font-medium text-text-subtle">
              / {compteur.objectif.toLocaleString('fr-FR')}
            </span>
          </p>

          <div
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: pastille }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${compteur.libelle} : ${pct} % de l’objectif`}
          >
            <span
              className="block h-full rounded-full transition-[width] duration-fluid"
              style={{ width: `${pct}%`, backgroundColor: teinte }}
            />
          </div>

          <p className="mt-2 text-[11px] text-text-subtle">
            {compteur.ecartSemainePrecedente === null
              ? 'première période'
              : `${ecartLisible(compteur.ecartSemainePrecedente)} vs période précédente`}
          </p>
        </>
      )}
    </li>
  );
}

/**
 * Les cinq familles en cartes égales.
 *
 * `levier` vient de la phrase du haut : la carte correspondante est cerclée,
 * pour que l'œil fasse le lien entre ce qu'on lui demande et où le regarder.
 */
export default function CompteursActivite({
  familles,
  levier,
}: {
  familles: readonly Compteur[];
  levier: string | null;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {familles.map((c) => (
        <CarteCompteur key={c.activite} compteur={c} misEnAvant={c.activite === levier} />
      ))}
    </ul>
  );
}
