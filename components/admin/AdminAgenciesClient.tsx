'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import AddressAutocomplete, { type SelectedAddress } from '@/components/AddressAutocomplete';
import PostalCodesEditor, { postalCodesFromAddress } from '@/components/PostalCodesEditor';
import type { AdminDirectorDto } from '@/app/api/admin/directors/route';
import type { PostalCollision } from '@/lib/admin/postal-collisions';
import type { AgencyRequestRow, PlanCode } from '@/types/database';

const inputClass =
  'w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25';

const labelClass = 'mb-1 block text-sm font-medium text-gray-700';

export default function AdminAgenciesClient() {
  const [pendingRequests, setPendingRequests] = useState<AgencyRequestRow[]>([]);
  const [directors, setDirectors] = useState<AdminDirectorDto[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [agencyAddress, setAgencyAddress] = useState<SelectedAddress | null>(null);
  const [postalCodes, setPostalCodes] = useState<string[]>([]);
  const [plan, setPlan] = useState<PlanCode>('fondateur');
  const [directorMode, setDirectorMode] = useState<'existing' | 'invite'>('existing');
  const [existingDirectorId, setExistingDirectorId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [collisions, setCollisions] = useState<PostalCollision[]>([]);
  const [creating, setCreating] = useState(false);

  const primaryPostcode = agencyAddress?.postcode?.trim() || postalCodes[0] || null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, dirRes] = await Promise.all([
        fetch('/api/admin/agency-requests', { cache: 'no-store' }),
        fetch('/api/admin/directors', { cache: 'no-store' }),
      ]);
      const reqData = (await reqRes.json()) as { requests?: AgencyRequestRow[] };
      const dirData = (await dirRes.json()) as { directors?: AdminDirectorDto[] };
      if (reqRes.ok) setPendingRequests(reqData.requests ?? []);
      if (dirRes.ok) {
        setDirectors(dirData.directors ?? []);
        if ((dirData.directors ?? []).length > 0 && !existingDirectorId) {
          setExistingDirectorId(dirData.directors![0]!.profileId);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [existingDirectorId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (postalCodes.length === 0) {
      setCollisions([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(
        `/api/admin/postal-collisions?codes=${encodeURIComponent(postalCodes.join(','))}`,
      );
      const data = (await res.json()) as { collisions?: PostalCollision[] };
      if (res.ok) setCollisions(data.collisions ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [postalCodes]);

  const prefillFromRequest = (req: AgencyRequestRow) => {
    setRequestId(req.id);
    setName(req.agency_name);
    setAgencyAddress({
      label: req.address,
      latitude: 0,
      longitude: 0,
      city: '',
      postcode: req.codes_postaux[0] ?? '',
    });
    setPostalCodes([...req.codes_postaux]);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const handleAddressChange = (selected: SelectedAddress | null) => {
    setAgencyAddress(selected);
    if (selected?.postcode) {
      setPostalCodes((prev) => postalCodesFromAddress(prev, selected.postcode));
    }
  };

  const createAgency = async () => {
    if (!name.trim() || !agencyAddress?.label) {
      toast.error('Nom et adresse requis.');
      return;
    }
    if (
      !agencyAddress.latitude ||
      !agencyAddress.longitude ||
      (agencyAddress.latitude === 0 && agencyAddress.longitude === 0)
    ) {
      toast.error('Sélectionnez une adresse dans la liste BAN.');
      return;
    }
    if (postalCodes.length === 0) {
      toast.error('Au moins un code postal.');
      return;
    }

    setCreating(true);
    const res = await fetch('/api/admin/agencies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        address: agencyAddress.label.trim(),
        latitude: agencyAddress.latitude,
        longitude: agencyAddress.longitude,
        codesPostaux: postalCodes,
        plan,
        directorMode,
        existingDirectorId: directorMode === 'existing' ? existingDirectorId : undefined,
        inviteEmail: directorMode === 'invite' ? inviteEmail.trim() : undefined,
        requestId: requestId ?? undefined,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setCreating(false);

    if (!res.ok) {
      toast.error(data.error ?? 'Erreur création');
      return;
    }

    toast.success('Agence créée');
    setName('');
    setAgencyAddress(null);
    setPostalCodes([]);
    setRequestId(null);
    void load();
  };

  if (loading) {
    return <p className="text-sm text-mute">Chargement…</p>;
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Agences & secteurs</h1>
        <p className="mt-1 text-sm text-mute">Création manuelle — exclusivité vérifiée ci-dessous.</p>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-ink">Demandes en attente ({pendingRequests.length})</h2>
        {pendingRequests.length === 0 ? (
          <p className="mt-2 text-sm text-mute">Aucune demande en attente.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {pendingRequests.map((req) => (
              <li
                key={req.id}
                className="flex flex-col gap-3 rounded-xl border border-black/8 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-ink">{req.agency_name}</p>
                  <p className="text-sm text-mute">{req.address}</p>
                  <p className="mt-1 text-sm tabular-nums text-ink">{req.codes_postaux.join(', ')}</p>
                  {req.message ? (
                    <p className="mt-1 text-xs text-mute italic">&ldquo;{req.message}&rdquo;</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="btn btn-primary shrink-0"
                  onClick={() => prefillFromRequest(req)}
                >
                  Créer l&apos;agence
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-black/8 bg-white p-6 shadow-soft">
        <h2 className="text-lg font-semibold text-ink">
          {requestId ? 'Créer depuis une demande' : 'Création directe'}
        </h2>

        <div className="mt-5 flex max-w-lg flex-col gap-4">
          <div>
            <label htmlFor="admin-agency-name" className={labelClass}>
              Nom de l&apos;agence
            </label>
            <input
              id="admin-agency-name"
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="admin-agency-address" className={labelClass}>
              Adresse (BAN)
            </label>
            <AddressAutocomplete
              id="admin-agency-address"
              value={agencyAddress?.label ?? ''}
              onChange={handleAddressChange}
              inputClassName={`${inputClass} pl-10 pr-10`}
            />
          </div>

          <PostalCodesEditor
            postalCodes={postalCodes}
            onChange={setPostalCodes}
            primaryPostcode={primaryPostcode}
            labelClass={labelClass}
          />

          {collisions.length > 0 ? (
            <div className="rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold">Collision de secteur</p>
              <ul className="mt-2 space-y-1">
                {collisions.map((c) => (
                  <li key={`${c.code}-${c.agencyId}`}>
                    Le {c.code} est déjà attribué à {c.agencyName}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <label htmlFor="admin-plan" className={labelClass}>
              Plan
            </label>
            <select
              id="admin-plan"
              className={inputClass}
              value={plan}
              onChange={(e) => setPlan(e.target.value as PlanCode)}
            >
              <option value="fondateur">Fondateur</option>
              <option value="standard">Standard</option>
            </select>
          </div>

          <fieldset>
            <legend className={labelClass}>Directeur</legend>
            <div className="mt-2 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="directorMode"
                  checked={directorMode === 'existing'}
                  onChange={() => setDirectorMode('existing')}
                />
                Directeur existant
              </label>
              {directorMode === 'existing' ? (
                <select
                  className={inputClass}
                  value={existingDirectorId}
                  onChange={(e) => setExistingDirectorId(e.target.value)}
                >
                  {directors.map((d) => (
                    <option key={d.profileId} value={d.profileId}>
                      {d.firstName} {d.lastName} ({d.email})
                    </option>
                  ))}
                </select>
              ) : null}

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="directorMode"
                  checked={directorMode === 'invite'}
                  onChange={() => setDirectorMode('invite')}
                />
                Inviter un nouveau directeur
              </label>
              {directorMode === 'invite' ? (
                <input
                  type="email"
                  className={inputClass}
                  placeholder="email@agence.fr"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              ) : null}
            </div>
          </fieldset>

          <button
            type="button"
            className="btn btn-primary w-full sm:w-auto"
            disabled={creating}
            onClick={() => void createAgency()}
          >
            {creating ? 'Création…' : 'Créer l\'agence'}
          </button>
        </div>
      </section>
    </div>
  );
}
