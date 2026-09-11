'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useUser } from '@/lib/hooks/useUser';
import Select from '@/components/ui/Select';

type Props = {
  zoneLabel: string | null;
};

export default function AgencySwitcher({ zoneLabel }: Props) {
  const router = useRouter();
  const { agency, memberships, hasMultipleAgencies } = useUser();
  const [saving, setSaving] = useState(false);

  if (!hasMultipleAgencies) {
    return (
      <>
        <p className="truncate font-medium text-white" style={{ fontSize: 14 }} title={agency.name}>
          {agency.name}
        </p>
        {zoneLabel ? (
          <p className="mt-1.5 truncate text-[11px] leading-snug text-white/65" title={zoneLabel}>
            {zoneLabel}
          </p>
        ) : null}
      </>
    );
  }

  const switchAgency = async (agencyId: string) => {
    if (agencyId === agency.id || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/dashboard/active-agency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agencyId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? 'Impossible de changer d\'agence');
        return;
      }
      router.refresh();
    } catch {
      toast.error('Impossible de changer d\'agence');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-w-0">
      <label htmlFor="agency-switcher" className="sr-only">
        Agence active
      </label>
      <Select
        id="agency-switcher"
        value={agency.id}
        disabled={saving}
        onChange={(agencyId) => void switchAgency(agencyId)}
        options={memberships.map((m) => ({
          value: m.agency_id,
          label: m.agency?.name ?? 'Agence',
        }))}
        aria-label="Choisir l'agence active"
        triggerClassName="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/10 py-2 pl-2.5 pr-2 text-left text-[13px] font-medium text-white outline-none transition-colors duration-fluid-subtle ease-in-out hover:bg-white/15 focus-visible:border-white/25 focus-visible:ring-2 focus-visible:ring-white/20 disabled:opacity-60 [&>svg]:text-white/70"
      />
      {zoneLabel ? (
        <p className="mt-1.5 truncate text-[11px] leading-snug text-white/65" title={zoneLabel}>
          {zoneLabel}
        </p>
      ) : null}
    </div>
  );
}
