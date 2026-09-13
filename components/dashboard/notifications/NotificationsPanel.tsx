'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRightLeft,
  AudioLines,
  Cake,
  ChevronDown,
  Eye,
  FileClock,
  Inbox,
  Map,
  MapPin,
  MapPinned,
  UserCheck,
  UserPlus,
  UserRoundX,
  type LucideIcon,
} from 'lucide-react';
import { formatNoteWhen } from '@/lib/notes/format-when';
import { regrouperNotifications, type GroupeNotification } from '@/lib/notifications/regrouper';
import type { Notification, NotificationType } from '@/lib/notifications/types';
import { FIELD } from '@/lib/today/field';
import { useNotifications } from '@/components/providers/NotificationsProvider';

const ICONE: Record<NotificationType, LucideIcon> = {
  leads_livres: MapPin,
  leads_assignes: UserPlus,
  contact_transfere: ArrowRightLeft,
  invitation_acceptee: UserCheck,
  zone_modifiee: Map,
  estimation_consultee: Eye,
  demande_estimation: MapPin,
  lead_portail: Inbox,
  note_transcrite: AudioLines,
  estimation_calculee: Eye,
  import_termine: Inbox,
  anniversaire: Cake,
  negociateur_sans_activite: UserRoundX,
  zone_non_travaillee: MapPinned,
  mandat_60_jours: FileClock,
};

type Onglet = 'non_lues' | 'tout';

function Ligne({
  groupe,
  deplie,
  onToggle,
  onOpen,
}: {
  groupe: GroupeNotification;
  deplie: boolean;
  onToggle: () => void;
  onOpen: (items: Notification[]) => void;
}) {
  const Icone = ICONE[groupe.type];
  const multiple = groupe.items.length > 1;
  const nonLue = !groupe.lue;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          if (multiple) onToggle();
          else onOpen(groupe.items);
        }}
        aria-expanded={multiple ? deplie : undefined}
        className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors duration-fluid-subtle ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${
          nonLue ? 'bg-[#FFF7F0]' : 'bg-transparent hover:bg-black/[0.03]'
        }`}
      >
        {nonLue ? (
          <span
            className="absolute left-1.5 top-1/2 size-1.5 -translate-y-1/2 rounded-full"
            style={{ backgroundColor: FIELD.orange }}
            aria-hidden
          />
        ) : null}
        <span
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-text-subtle"
          aria-hidden
        >
          <Icone size={16} strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-text-strong" style={{ fontSize: 14 }}>
            {groupe.titre}
          </span>
          <span className="mt-0.5 block truncate text-text-subtle" style={{ fontSize: 13 }}>
            {groupe.corps}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
          <span className="tabular-nums text-text-subtle" style={{ fontSize: 11 }}>
            {formatNoteWhen(groupe.createdAt)}
          </span>
          {multiple ? (
            <ChevronDown
              size={14}
              strokeWidth={2}
              className={`text-text-subtle transition-transform duration-fluid-subtle ${deplie ? 'rotate-180' : ''}`}
              aria-hidden
            />
          ) : null}
        </span>
      </button>
      {multiple && deplie
        ? groupe.items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpen([item])}
              className="flex w-full items-start gap-3 py-2 pl-14 pr-3 text-left hover:bg-black/[0.03]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-text-strong" style={{ fontSize: 13 }}>
                  {item.titre}
                </span>
                <span className="mt-0.5 block truncate text-text-subtle" style={{ fontSize: 12 }}>
                  {item.corps}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-text-subtle" style={{ fontSize: 11 }}>
                {formatNoteWhen(item.createdAt)}
              </span>
            </button>
          ))
        : null}
    </div>
  );
}

export default function NotificationsPanel({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const { notifications, nonLues, marquerLue, marquerToutesLues } = useNotifications();
  const [onglet, setOnglet] = useState<Onglet>('non_lues');
  const [ouverts, setOuverts] = useState<Set<string>>(() => new Set());

  const source = useMemo(
    () => (onglet === 'non_lues' ? notifications.filter((n) => !n.lueLe) : notifications),
    [notifications, onglet],
  );
  const groupes = useMemo(() => regrouperNotifications(source), [source]);

  const ouvrir = (items: Notification[]) => {
    marquerLue(items.map((i) => i.id));
    const lien = items[0]?.lien;
    onNavigate?.();
    if (lien) router.push(lien);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 bg-surface px-4 pb-2 pt-1">
        <div className="flex gap-1" role="tablist" aria-label="Filtrer les notifications">
          {(
            [
              ['non_lues', 'Non lues'],
              ['tout', 'Tout'],
            ] as const
          ).map(([id, label]) => {
            const actif = onglet === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={actif}
                onClick={() => setOnglet(id)}
                className={`rounded-full px-3 py-1 font-medium transition-colors duration-fluid-subtle ${
                  actif ? 'bg-black/[0.06] text-text-strong' : 'text-text-subtle hover:text-text-strong'
                }`}
                style={{ fontSize: 13 }}
              >
                {label}
              </button>
            );
          })}
        </div>
        {nonLues > 0 ? (
          <button
            type="button"
            onClick={marquerToutesLues}
            className="text-text-subtle underline-offset-2 hover:text-text-strong hover:underline"
            style={{ fontSize: 12 }}
          >
            Tout marquer comme lu
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {groupes.length === 0 ? (
          <p className="px-4 py-10 text-center text-text-subtle" style={{ fontSize: 14 }}>
            Rien de nouveau
          </p>
        ) : (
          <ul className="divide-y divide-black/[0.04] pb-2">
            {groupes.map((groupe) => (
              <li key={groupe.id}>
                <Ligne
                  groupe={groupe}
                  deplie={ouverts.has(groupe.id)}
                  onToggle={() =>
                    setOuverts((prev) => {
                      const next = new Set(prev);
                      if (next.has(groupe.id)) next.delete(groupe.id);
                      else next.add(groupe.id);
                      return next;
                    })
                  }
                  onOpen={ouvrir}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
