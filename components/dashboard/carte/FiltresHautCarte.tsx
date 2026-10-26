'use client';

import { UserRound } from 'lucide-react';
import { pastilleClass } from '@/components/ui/pastille-classes';
import ProfileAvatar from '@/components/dashboard/ProfileAvatar';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import { ZONE_TOUS_SECTEURS } from '@/lib/carte/emprise';
import type { Zone } from '@/lib/zones/types';

/** Le fond des pastilles « à moi » : l'accent chaud de la charte, distinct du neutre de l'équipe. */
const PISTE_MIENNE = 'flex w-full flex-wrap rounded-clay bg-soft-warm p-1 shadow-clay-inset ring-1 ring-accent/20';

/** Même coque que Cadastre et Annonces. */
const CARTE_SECTEURS =
  'flex w-full flex-wrap items-center gap-1.5 rounded-[14px] bg-[#E6E8EB]/90 px-2.5 py-2.5';

function Titre({ children }: { children: string }) {
  return <p className="mb-1 px-0.5 text-[11.5px] font-medium text-text-subtle">{children}</p>;
}

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
      onClick={onClick}
      title={`${zone.nom} · ${proprietaire}`}
      className={`${pastilleClass(actif)} inline-flex min-w-0 max-w-full items-center gap-1.5`}
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
 * Le choix du secteur affiché. Pour le directeur qui a lui-même un secteur,
 * deux groupes qu'on ne confond pas : « Mon secteur » (fond chaud, icône de
 * personne) et « Secteurs de l'agence » (fond neutre, initiales de l'agent).
 * « Tous » affiche tous les secteurs proposés ensemble.
 */
export function ChoixSecteurs({
  zones,
  zoneId,
  onZone,
  tous = false,
  profileId,
  membres = [],
}: {
  zones: readonly Zone[];
  zoneId: string;
  onZone: (id: string) => void;
  /** Le directeur peut afficher tous les secteurs en même temps. */
  tous?: boolean;
  /** L'agent connecté : ses secteurs passent dans « Mon secteur » (« Mes secteurs »). */
  profileId?: string;
  /** Membres de l'agence : les initiales de qui tient chaque secteur. */
  membres?: readonly AssigneeOption[];
}) {
  if (zones.length === 0) return null;
  const parId = new Map(membres.map((m) => [m.id, m]));
  const miennes = profileId ? zones.filter((z) => z.assignedTo === profileId) : [];
  const agence = zones.filter((z) => !miennes.includes(z));
  // L'agent qui tient plusieurs secteurs les affiche aussi tous ensemble.
  const montrerTous = zones.length > 1 && (tous || miennes.length === zones.length);
  const deuxGroupes = tous && miennes.length > 0 && agence.length > 0;

  const boutonTous = montrerTous ? (
    <button
      type="button"
      aria-pressed={zoneId === ZONE_TOUS_SECTEURS}
      onClick={() => onZone(ZONE_TOUS_SECTEURS)}
      className={`${pastilleClass(zoneId === ZONE_TOUS_SECTEURS)} min-w-0`}
    >
      Tous
    </button>
  ) : null;

  const pastille = (z: Zone) => (
    <PastilleZone
      key={z.id}
      zone={z}
      actif={z.id === zoneId}
      onClick={() => onZone(z.id)}
      membre={z.assignedTo ? parId.get(z.assignedTo) : undefined}
      mienne={z.assignedTo != null && z.assignedTo === profileId}
    />
  );

  if (!deuxGroupes) {
    return (
      <li>
        <div role="group" aria-label="Secteur" className={`${CARTE_SECTEURS} mb-1.5`}>
          {boutonTous}
          {zones.map(pastille)}
        </div>
      </li>
    );
  }

  return (
    <li className="mb-1.5 flex flex-col gap-2.5">
      <div>
        <Titre>{miennes.length > 1 ? 'Mes secteurs' : 'Mon secteur'}</Titre>
        <div role="group" aria-label={miennes.length > 1 ? 'Mes secteurs' : 'Mon secteur'} className={PISTE_MIENNE}>
          {miennes.map(pastille)}
        </div>
      </div>
      <div>
        <Titre>Secteurs de l’agence</Titre>
        <div role="group" aria-label="Secteurs de l’agence" className={CARTE_SECTEURS}>
          {boutonTous}
          {agence.map(pastille)}
        </div>
      </div>
    </li>
  );
}
