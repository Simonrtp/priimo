'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import type { AgencyOverview } from '@/lib/today/agency-overview';
import WorkspaceCard, { CardEyebrow } from '@/components/dashboard/workspace/WorkspaceCard';

const STORAGE_KEY = 'priimo-vue-agence-collapsed';

function readCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'Aucune donnée';
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  if (days < 30) return `Il y a ${days} jours`;
  const months = Math.round(days / 30);
  return months <= 1 ? 'Il y a un mois' : `Il y a ${months} mois`;
}

function CountLink({
  href,
  count,
  label,
}: {
  href: string;
  count: number;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[44px] flex-col justify-center rounded-xl px-3 py-2 hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span className="tabular-nums text-[22px] font-semibold text-text-strong">{count}</span>
      <span className="mt-0.5 text-pretty text-[12.5px] text-text-muted">{label}</span>
    </Link>
  );
}

export default function AgencyOverviewBlock({
  overview,
  defaultCollapsed = false,
}: {
  overview: AgencyOverview;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(() =>
    defaultCollapsed ? true : readCollapsed(),
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      // quota
    }
  }, [collapsed]);

  return (
    <section className="mb-6 md:mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-balance text-[16px] font-semibold text-text-strong sm:text-[18px]">
          Vue agence
        </h2>
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((v) => !v)}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-clay px-3 text-[13px] font-medium text-text-muted hover:bg-black/[0.04] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {collapsed ? 'Déplier' : 'Replier'}
          <ChevronDown
            size={16}
            className={collapsed ? '' : 'rotate-180'}
            aria-hidden
          />
        </button>
      </div>

      {collapsed ? null : (
        <div className="flex flex-col gap-3 md:gap-4">
          <WorkspaceCard>
            <CardEyebrow>Activité de la semaine</CardEyebrow>
            <ul className="mt-4 flex flex-col gap-2">
              {overview.activity.map((row) => (
                <li
                  key={row.memberId}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-black/[0.05] py-2 last:border-b-0"
                >
                  <p className="text-[14px] font-medium text-text-strong">{row.fullName}</p>
                  {row.volume === 0 ? (
                    <p className="text-[13px] text-text-subtle">Aucune activité</p>
                  ) : (
                    <p className="text-[13px] text-text-muted">
                      <span className="tabular-nums">{row.voiceNotes}</span> notes ·{' '}
                      <span className="tabular-nums">{row.contacts}</span> contacts ·{' '}
                      <span className="tabular-nums">{row.interactions}</span> interactions
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </WorkspaceCard>

          <WorkspaceCard>
            <CardEyebrow>Couverture terrain</CardEyebrow>
            {overview.coverage.length === 0 ? (
              <p className="mt-3 text-pretty text-[13.5px] text-text-muted">
                Aucun code postal n&apos;est rattaché à l&apos;agence.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {overview.coverage.map((row) => (
                  <li
                    key={row.postalCode}
                    className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl px-2 py-2 ${
                      row.stale ? 'bg-accent/10' : ''
                    }`}
                  >
                    <div>
                      <p className="tabular-nums text-[14px] font-semibold text-text-strong">
                        {row.postalCode}
                      </p>
                      <p className="text-[12.5px] text-text-muted">
                        <span className="tabular-nums">{row.buildingCount}</span>
                        {row.buildingCount > 1 ? ' immeubles' : ' immeuble'}
                        {' · '}
                        {formatRelative(row.lastActivityAt)}
                      </p>
                    </div>
                    {row.stale ? (
                      <p className="text-[12px] font-medium text-accent">Sans passage depuis 60 jours</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </WorkspaceCard>

          <WorkspaceCard>
            <CardEyebrow>Ce qui dort</CardEyebrow>
            <div className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-3">
              <CountLink
                href="/dashboard/prospection?filtre=non-assignes-14j"
                count={overview.sleeping.unassignedLeads}
                label="Leads non assignés depuis 14 jours"
              />
              <CountLink
                href="/dashboard/contacts?filtre=vendeurs-inactifs"
                count={overview.sleeping.silentVendeurs}
                label="Vendeurs sans interaction depuis 45 jours"
              />
              <CountLink
                href="/dashboard/biens?filtre=mandats-endormis"
                count={overview.sleeping.staleMandats}
                label="Mandats sans mise à jour depuis 30 jours"
              />
            </div>
          </WorkspaceCard>
        </div>
      )}
    </section>
  );
}
