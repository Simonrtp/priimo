'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import type { NoteLienEntite } from '@/types/contact';
import { banFeatureToSelectedAddress, searchBanAddresses } from '@/lib/ban';
import {
  filtrerCatalogue,
  RATTACHER_CARTES,
  type RattacherItem,
  type RattacherKind,
} from '@/lib/notes/rattacher-catalogue';
import Select from '@/components/ui/Select';
import { Field, TextInput } from '@/components/dashboard/workspace/Field';

export type NoteLinkPick = {
  entiteType: NoteLienEntite;
  entiteId: string;
  label: string;
  subtitle: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  banId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  propertyType?: string | null;
  surfaceM2?: number | null;
  rooms?: number | null;
};

type BanHit = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

const BAN_MIN_LEN = 3;

const CHOISIR: Record<RattacherKind, string> = {
  contact: 'Choisir un contact…',
  bien: 'Choisir un bien…',
  lead: 'Choisir un prospect…',
  immeuble: 'Rechercher une adresse…',
};

export default function NoteEntitySearch({
  onPick,
  onCreateContact,
  disabled = false,
  excludeIds,
  id,
  className = 'w-full',
  label = 'Rattachement du contact',
  hint = 'Rattacher avec un contact, un bien, un prospect ou un immeuble.',
}: {
  onPick: (pick: NoteLinkPick) => void;
  onCreateContact?: () => void;
  disabled?: boolean;
  excludeIds?: ReadonlySet<string>;
  id?: string;
  className?: string;
  label?: string;
  hint?: string;
}) {
  const generatedId = useId();
  const kindId = id ?? `${generatedId}-kind`;
  const cibleId = `${generatedId}-cible`;
  const [kind, setKind] = useState<RattacherKind>('contact');
  const [cible, setCible] = useState('');
  const [catalogue, setCatalogue] = useState<Record<'contact' | 'bien' | 'lead', RattacherItem[]>>({
    contact: [],
    bien: [],
    lead: [],
  });
  const [banHits, setBanHits] = useState<BanHit[]>([]);
  const [banQuery, setBanQuery] = useState('');

  useEffect(() => {
    let cancel = false;
    void fetch('/api/dashboard/rattacher')
      .then((r) => r.json())
      .then((data: { contact?: RattacherItem[]; bien?: RattacherItem[]; lead?: RattacherItem[] }) => {
        if (cancel) return;
        setCatalogue({
          contact: data.contact ?? [],
          bien: data.bien ?? [],
          lead: data.lead ?? [],
        });
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (kind !== 'immeuble') {
      setBanHits([]);
      return;
    }
    const q = banQuery.trim();
    if (q.length < BAN_MIN_LEN) {
      setBanHits([]);
      return;
    }
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      void searchBanAddresses(q, 8, undefined, ac.signal)
        .then((features) => {
          setBanHits(
            features.flatMap((feature) => {
              const selected = banFeatureToSelectedAddress(feature);
              if (!selected.id) return [];
              return [
                {
                  id: selected.id,
                  label: selected.label,
                  latitude: selected.latitude,
                  longitude: selected.longitude,
                },
              ];
            }),
          );
        })
        .catch(() => {
          if (!ac.signal.aborted) setBanHits([]);
        });
    }, 220);
    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [kind, banQuery]);

  const options = useMemo(() => {
    const vide = [{ value: '', label: CHOISIR[kind] }];
    if (kind === 'immeuble') {
      return [
        ...vide,
        ...banHits
          .filter((b) => !excludeIds?.has(`immeuble:${b.id}`))
          .map((b) => ({ value: b.id, label: b.label })),
      ];
    }
    const items = filtrerCatalogue(
      catalogue[kind].filter((item) => !excludeIds?.has(`${item.kind}:${item.id}`)),
      '',
    );
    const extra =
      kind === 'contact' && onCreateContact
        ? [{ value: '__create__', label: 'Rajouter un contact' }]
        : [];
    return [
      ...vide,
      ...extra,
      ...items.map((item) => ({
        value: item.id,
        label: item.subtitle ? `${item.label} · ${item.subtitle}` : item.label,
      })),
    ];
  }, [banHits, catalogue, excludeIds, kind, onCreateContact]);

  function appliquer(value: string) {
    setCible('');
    if (!value) return;
    if (value === '__create__') {
      onCreateContact?.();
      return;
    }
    if (kind === 'immeuble') {
      const ban = banHits.find((b) => b.id === value);
      if (!ban) return;
      onPick({
        entiteType: 'immeuble',
        entiteId: ban.id,
        label: ban.label,
        subtitle: 'Immeuble',
        latitude: ban.latitude,
        longitude: ban.longitude,
      });
      setBanQuery('');
      return;
    }
    const carte = RATTACHER_CARTES.find((c) => c.id === kind);
    const item = catalogue[kind].find((i) => i.id === value);
    if (!carte || !item) return;
    onPick({
      entiteType: carte.entite,
      entiteId: item.id,
      label: item.label,
      subtitle: item.subtitle,
      address: item.address ?? (item.kind === 'bien' ? item.label : null),
      city: item.city,
      postalCode: item.postalCode,
      banId: item.banId,
      latitude: item.latitude,
      longitude: item.longitude,
      propertyType: item.propertyType,
      surfaceM2: item.surfaceM2,
      rooms: item.rooms,
    });
  }

  return (
    <div className={className}>
      <Field label={label} htmlFor={kindId} hint={hint}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="sm:w-[11.5rem] sm:shrink-0">
            <Select
              id={kindId}
              value={kind}
              disabled={disabled}
              onChange={(v) => {
                setKind((v || 'contact') as RattacherKind);
                setCible('');
                setBanQuery('');
              }}
              options={RATTACHER_CARTES.map((carte) => ({
                value: carte.id,
                label: `Avec un ${carte.label.toLocaleLowerCase('fr')}`,
              }))}
              aria-label="Rattacher avec"
            />
          </div>
          <div className="relative min-w-0 flex-1">
            {kind === 'immeuble' ? (
              <>
                <TextInput
                  id={cibleId}
                  value={banQuery}
                  disabled={disabled}
                  placeholder="Rechercher une adresse…"
                  aria-label="Rechercher une adresse"
                  autoComplete="off"
                  onChange={(e) => setBanQuery(e.target.value)}
                />
                {banHits.length > 0 ? (
                  <ul className="absolute z-[230] mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-black/[0.10] bg-surface py-1 shadow-clay-lg">
                    {banHits
                      .filter((b) => !excludeIds?.has(`immeuble:${b.id}`))
                      .map((b) => (
                        <li key={b.id}>
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => appliquer(b.id)}
                            className="flex w-full px-3 py-2.5 text-left text-[14px] text-text hover:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
                          >
                            {b.label}
                          </button>
                        </li>
                      ))}
                  </ul>
                ) : null}
              </>
            ) : (
              <Select
                id={cibleId}
                value={cible}
                disabled={disabled}
                searchable
                searchPlaceholder="Rechercher…"
                onChange={appliquer}
                options={options}
                aria-label={CHOISIR[kind]}
              />
            )}
          </div>
        </div>
      </Field>
    </div>
  );
}
