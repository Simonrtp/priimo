'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/lib/hooks/useUser';

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
      <div className="relative">
        <select
          id="agency-switcher"
          value={agency.id}
          disabled={saving}
          onChange={(e) => void switchAgency(e.target.value)}
          className="w-full appearance-none truncate rounded-lg border border-white/10 bg-white/10 py-2 pl-2.5 pr-8 text-[13px] font-medium text-white outline-none transition-colors hover:bg-white/15 focus:border-white/25 focus:ring-2 focus:ring-white/20 disabled:opacity-60"
          aria-label="Choisir l'agence active"
        >
          {memberships.map((m) => (
            <option key={m.agency_id} value={m.agency_id} className="text-ink">
              {m.agency?.name ?? 'Agence'}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/70"
          aria-hidden
        />
      </div>
      {zoneLabel ? (
        <p className="mt-1.5 truncate text-[11px] leading-snug text-white/65" title={zoneLabel}>
          {zoneLabel}
        </p>
      ) : null}
    </div>
  );
}
