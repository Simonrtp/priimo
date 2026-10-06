'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { useUser } from '@/lib/hooks/useUser';
import { useNotifications } from '@/components/providers/NotificationsProvider';
import { regrouperNotifications } from '@/lib/notifications/regrouper';
import { ACCUEIL_DARK, FIELD } from '@/lib/today/field';

const STORAGE_PREFIX = 'priimo-notifs-welcome:';

function dejaVuCetteSession(agencyId: string): boolean {
  if (typeof sessionStorage === 'undefined') return true;
  try {
    return sessionStorage.getItem(`${STORAGE_PREFIX}${agencyId}`) === '1';
  } catch {
    return true;
  }
}

function marquerVu(agencyId: string) {
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${agencyId}`, '1');
  } catch {
    /* mode privé / quota */
  }
}

/**
 * Une fois par session : résume les non lues. Fermer ne marque pas comme lu —
 * la cloche garde la mémoire.
 */
export default function NotificationsWelcomePopup() {
  const { agency } = useUser();
  const { notifications, nonLues, ouvrirCloche } = useNotifications();
  const titleId = useId();
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    if (nonLues <= 0) return;
    if (dejaVuCetteSession(agency.id)) return;
    setOuvert(true);
  }, [agency.id, nonLues]);

  const { groupes, reste } = useMemo(() => {
    const nonLuesItems = notifications.filter((n) => !n.lueLe);
    const tous = regrouperNotifications(nonLuesItems);
    const top = tous.slice(0, 5);
    const affiches = top.reduce((n, g) => n + g.items.length, 0);
    return { groupes: top, reste: Math.max(0, nonLuesItems.length - affiches) };
  }, [notifications]);

  if (!ouvert || nonLues <= 0) return null;

  function fermer() {
    marquerVu(agency.id);
    setOuvert(false);
  }

  function voir() {
    marquerVu(agency.id);
    setOuvert(false);
    ouvrirCloche();
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-[rgba(26,42,86,0.42)] p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="w-full max-w-[400px] overflow-hidden rounded-clay-lg border border-black/10 bg-surface shadow-clay-lg">
        <div className="flex items-start gap-3 px-5 pb-3 pt-5">
          <span
            className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-black/[0.06]"
            style={{ color: ACCUEIL_DARK.bleu }}
            aria-hidden
          >
            <Bell size={18} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="text-balance font-semibold text-text-strong"
              style={{ fontSize: 17 }}
            >
              {nonLues === 1 ? 'Du nouveau pour toi' : `${nonLues} nouveautés pour toi`}
            </h2>
            <p className="mt-1 text-text-subtle" style={{ fontSize: 13.5 }}>
              Elles restent dans la cloche du header.
            </p>
          </div>
        </div>

        <ul className="max-h-[40vh] overflow-y-auto border-t border-black/[0.06] px-2 py-1">
          {groupes.map((g) => (
            <li key={g.id} className="rounded-xl px-3 py-2.5">
              <p className="truncate font-medium text-text-strong" style={{ fontSize: 14 }}>
                {g.titre}
              </p>
              <p className="mt-0.5 truncate text-text-subtle" style={{ fontSize: 13 }}>
                {g.corps}
              </p>
            </li>
          ))}
          {reste > 0 ? (
            <li className="px-3 py-2 text-text-subtle" style={{ fontSize: 13 }}>
              et {reste} autre{reste > 1 ? 's' : ''}
            </li>
          ) : null}
        </ul>

        <div className="flex gap-2 border-t border-black/[0.06] px-4 py-3">
          <button
            type="button"
            onClick={fermer}
            className="min-h-[44px] flex-1 rounded-clay border border-black/10 bg-white px-3 text-[14px] font-medium text-text-strong transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Plus tard
          </button>
          <button
            type="button"
            onClick={voir}
            className="min-h-[44px] flex-1 rounded-clay px-3 text-[14px] font-semibold text-white transition-colors duration-fluid-subtle ease-in-out hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            style={{ backgroundColor: FIELD.ardoise }}
          >
            Voir
          </button>
        </div>
      </div>
    </div>
  );
}
