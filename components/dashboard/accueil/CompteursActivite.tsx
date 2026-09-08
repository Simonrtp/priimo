'use client';

import {
  Building2,
  DoorOpen,
  FileSearch,
  MessageSquareQuote,
  PhoneCall,
  type LucideIcon,
} from 'lucide-react';
import { COULEUR_FAMILLE } from '@/lib/activite/couleurs';
import type { Compteur, FamilleActivite } from '@/lib/activite/types';

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

function CarteCompteur({ compteur }: { compteur: Compteur }) {
  const famille = compteur.activite as FamilleActivite;
  const { teinte, pastille } = COULEUR_FAMILLE[famille];
  const Icone = ICONE[famille];
  const pct =
    compteur.objectif > 0
      ? Math.min(100, Math.round((compteur.valeur / compteur.objectif) * 100))
      : 0;

  return (
    <li className="flex min-w-0 flex-col rounded-clay-lg bg-surface p-4 shadow-clay-sm">
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-[12px]"
        style={{ backgroundColor: teinte, color: '#FFFFFF' }}
      >
        <Icone size={18} strokeWidth={2.4} />
      </span>

      <p className="mt-3 text-[12px] font-semibold leading-tight text-text-strong">
        {compteur.libelle}
      </p>

      <p className="mt-1 flex items-baseline gap-1.5">
        <span
          className="font-display text-[28px] font-bold leading-none tabular-nums"
          style={{ color: teinte }}
        >
          {compteur.valeur.toLocaleString('fr-FR')}
        </span>
        <span className="text-[13px] font-semibold tabular-nums text-text-strong/55">
          / {compteur.objectif.toLocaleString('fr-FR')}
        </span>
      </p>

      <div
        className="mt-3 h-2.5 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: pastille }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${compteur.libelle} : ${pct} % de l’objectif`}
      >
        <span
          className="block h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: teinte }}
        />
      </div>

      <p className="mt-2 text-[11px] font-medium text-text-strong/50">
        {compteur.ecartSemainePrecedente === null
          ? 'première période'
          : `${ecartLisible(compteur.ecartSemainePrecedente)} vs période précédente`}
      </p>
    </li>
  );
}

/** Les cinq familles en cartes égales. */
export default function CompteursActivite({
  familles,
}: {
  familles: readonly Compteur[];
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {familles.map((c) => (
        <CarteCompteur key={c.activite} compteur={c} />
      ))}
    </ul>
  );
}
