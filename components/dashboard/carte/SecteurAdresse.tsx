'use client';

import { useMemo } from 'react';
import { useCarteSecteurs } from '@/lib/zones/useCarteSecteurs';
import { useUser } from '@/lib/hooks/useUser';

/**
 * À qui appartient l'adresse : une ligne discrète, la couleur du secteur en
 * pastille. Lu sur les parcelles des secteurs, jamais stocké sur la fiche.
 */
export default function SecteurAdresse({
  parcelleIds,
  className = '',
}: {
  parcelleIds: readonly string[];
  className?: string;
}) {
  const carte = useCarteSecteurs();
  const { profile } = useUser();
  const zoneId = useMemo(() => {
    const voulues = new Set(parcelleIds);
    return carte.features.find((f) => voulues.has(f.properties.parcelleId))?.properties.zoneId ?? null;
  }, [carte.features, parcelleIds]);
  const secteur = zoneId ? carte.secteurs.find((s) => s.zoneId === zoneId) : undefined;

  // Tant que les secteurs ne sont pas chargés, on n'affirme rien.
  if (parcelleIds.length === 0 || carte.secteurs.length === 0) return null;

  const mien = secteur?.assignedTo != null && secteur.assignedTo === profile?.id;
  const prenom =
    secteur?.agent?.trim() ||
    (mien ? profile.first_name?.trim() || null : null);
  const nom = secteur?.nom ? `« ${secteur.nom} »` : 'sans nom';
  const phrase = !secteur ? (
    'Cette adresse n’est dans aucun secteur'
  ) : prenom ? (
    <>
      Cette adresse appartient au secteur de{' '}
      <strong className="font-semibold text-text-strong">{prenom}</strong>
    </>
  ) : (
    <>
      Cette adresse appartient au secteur{' '}
      <strong className="font-semibold text-text-strong">{nom}</strong>, sans agent
    </>
  );

  return (
    <p className={`flex items-center gap-2 text-[13px] text-text-muted ${className}`}>
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-full"
        style={{ background: secteur?.couleur ?? 'rgba(0,0,0,0.2)' }}
      />
      <span className="min-w-0">{phrase}</span>
    </p>
  );
}
