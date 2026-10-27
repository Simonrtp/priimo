'use client';

import { Plus, UserRound } from 'lucide-react';
import { pastilleGlissanteClass } from '@/components/ui/pastille-classes';
import { PistePastilles } from '@/components/ui/Pastilles';
import ProfileAvatar from '@/components/dashboard/ProfileAvatar';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import { ZONE_TOUS_SECTEURS } from '@/lib/carte/emprise';
import type { Zone } from '@/lib/zones/types';

/** Même coque que Cadastre et Annonces. */
const CARTE_SECTEURS =
  'flex w-full flex-wrap items-center gap-1.5 rounded-[14px] bg-[#E6E8EB]/90 px-2.5 py-2.5';

function PastilleZone({
  zone,
  actif,
  onClick,
  membre,
  mienne,
}: {
  zone: Zone;
  actif: boolean;
  onClick: () => void;
  membre?: AssigneeOption;
  mienne: boolean;
}) {
  const proprietaire = mienne ? 'à moi' : membre ? membre.fullName : 'sans agent';
  return (
    <button
      type="button"
      aria-pressed={actif}
      data-pastille-active={actif || undefined}
      onClick={onClick}
      title={`${zone.nom} · ${proprietaire}`}
      className={`${pastilleGlissanteClass(actif)} inline-flex min-w-0 max-w-full items-center gap-1.5`}
    >
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: zone.couleur }} />
      <span className="truncate">{zone.nom}</span>
      {mienne ? (
        <UserRound size={13} strokeWidth={2.2} aria-hidden className={`shrink-0 ${actif ? 'text-white' : 'text-accent-dark'}`} />
      ) : membre ? (
        <ProfileAvatar
          firstName={membre.firstName ?? membre.fullName.split(/\s+/)[0] ?? ''}
          lastName={membre.lastName ?? membre.fullName.split(/\s+/).slice(1).join(' ')}
          avatarUrl={membre.avatarUrl}
          size={16}
          fond={actif ? '#FFFFFF' : undefined}
          className="shrink-0"
        />
      ) : null}
    </button>
  );
}

/**
 * Pastilles de mes secteurs uniquement — même UI directeur / collaborateur.
 * Les secteurs des collègues : case « Tous les secteurs » au-dessus de Contacts.
 */
export function ChoixSecteurs({
  zones,
  zoneId,
  onZone,
  profileId,
  membres = [],
  onCreer,
}: {
  zones: readonly Zone[];
  zoneId: string;
  onZone: (id: string) => void;
  profileId?: string;
  membres?: readonly AssigneeOption[];
  onCreer?: () => void;
}) {
  if (zones.length === 0) return null;
  const parId = new Map(membres.map((m) => [m.id, m]));
  const montrerTous = zones.length > 1;

  return (
    <li>
      <PistePastilles role="group" label="Secteur" className={`${CARTE_SECTEURS} mb-1.5`}>
        {montrerTous ? (
          <button
            type="button"
            aria-pressed={zoneId === ZONE_TOUS_SECTEURS}
            data-pastille-active={zoneId === ZONE_TOUS_SECTEURS || undefined}
            onClick={() => onZone(ZONE_TOUS_SECTEURS)}
            className={`${pastilleGlissanteClass(zoneId === ZONE_TOUS_SECTEURS)} min-w-0`}
          >
            Tous
          </button>
        ) : null}
        {zones.map((z) => (
          <PastilleZone
            key={z.id}
            zone={z}
            actif={z.id === zoneId}
            onClick={() => onZone(z.id)}
            membre={z.assignedTo ? parId.get(z.assignedTo) : undefined}
            mienne={z.assignedTo != null && z.assignedTo === profileId}
          />
        ))}
        {onCreer ? (
          <button
            type="button"
            onClick={onCreer}
            className={`${pastilleGlissanteClass(false)} inline-flex min-w-0 items-center gap-1.5`}
          >
            <Plus size={13} strokeWidth={2.2} aria-hidden />
            Nouveau secteur
          </button>
        ) : null}
      </PistePastilles>
    </li>
  );
}
