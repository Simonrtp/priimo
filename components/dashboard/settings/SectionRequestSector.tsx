'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import AddressAutocomplete, { type SelectedAddress } from '@/components/AddressAutocomplete';
import PostalCodesEditor, { postalCodesFromAddress } from '@/components/PostalCodesEditor';
import type { AgencyRequestRow } from '@/types/database';

const inputClass =
  'w-full rounded-lg border border-black/10 px-[14px] py-[10px] text-[14px] text-ink placeholder:text-mute/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25';

const labelClass = 'mb-1.5 block font-medium text-gray-700';

const STATUS_LABEL: Record<AgencyRequestRow['status'], string> = {
  en_attente: 'En attente de validation',
  acceptee: 'Acceptée',
  refusee: 'Refusée',
};

export default function SectionRequestSector() {
  const [agencyName, setAgencyName] = useState('');
  const [agencyAddress, setAgencyAddress] = useState<SelectedAddress | null>(null);
  const [postalCodes, setPostalCodes] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [requests, setRequests] = useState<AgencyRequestRow[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  const primaryPostcode = agencyAddress?.postcode?.trim() || postalCodes[0] || null;

  const loadRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const res = await fetch('/api/dashboard/agency-requests', { cache: 'no-store' });
      const data = (await res.json()) as { requests?: AgencyRequestRow[]; error?: string };
      if (res.ok) setRequests(data.requests ?? []);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests, submitted]);

  const handleAddressChange = (selected: SelectedAddress | null) => {
    setAgencyAddress(selected);
    if (selected?.postcode) {
      setPostalCodes((prev) => postalCodesFromAddress(prev, selected.postcode));
    } else if (!selected) {
      setPostalCodes([]);
    }
  };

  const submit = async () => {
    if (!agencyName.trim()) {
      toast.error("Indiquez le nom de l'agence.");
      return;
    }
    if (!agencyAddress?.label?.trim()) {
      toast.error("Sélectionnez l'adresse dans la liste de suggestions.");
      return;
    }
    if (postalCodes.length === 0) {
      toast.error('Au moins un code postal est requis.');
      return;
    }

    setSubmitting(true);
    const res = await fetch('/api/dashboard/agency-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agencyName: agencyName.trim(),
        address: agencyAddress.label.trim(),
        codesPostaux: postalCodes,
        message: message.trim() || undefined,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setSubmitting(false);

    if (!res.ok) {
      toast.error(data.error ?? 'Erreur lors de l\'envoi');
      return;
    }

    setSubmitted(true);
    setAgencyName('');
    setAgencyAddress(null);
    setPostalCodes([]);
    setMessage('');
    toast.success('Demande envoyée');
    void loadRequests();
  };

  const pendingRequests = requests.filter((r) => r.status === 'en_attente');

  return (
    <div className="mt-8 border-t border-black/[0.06] pt-8">
      <h3 className="font-semibold text-ink" style={{ fontSize: 16 }}>
        Ajouter un secteur
      </h3>
      <p className="mt-2 text-sm text-mute" style={{ lineHeight: 1.55 }}>
        Vous gérez plusieurs agences ? Chaque secteur supplémentaire est{' '}
        <strong className="font-medium text-ink">exclusif</strong> et fait l&apos;objet d&apos;un
        abonnement dédié. Dites-nous lequel vous intéresse, nous vérifions sa disponibilité.
      </p>

      {submitted ? (
        <div
          className="mt-4 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-sm text-ink"
          role="status"
        >
          Demande envoyée. Nous vérifions la disponibilité du secteur et revenons vers vous sous 48
          heures.
        </div>
      ) : null}

      <div className="mt-5 flex max-w-xl flex-col gap-4">
        <div>
          <label htmlFor="request-agency-name" className={labelClass}>
            Nom de l&apos;agence
          </label>
          <input
            id="request-agency-name"
            className={inputClass}
            placeholder='Ex. "Century 21 Belleville"'
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="request-agency-address" className={labelClass}>
            Adresse de l&apos;agence
          </label>
          <AddressAutocomplete
            id="request-agency-address"
            value={agencyAddress?.label ?? ''}
            onChange={handleAddressChange}
            placeholder="Ex : 12 rue de Belleville, Paris"
            inputClassName={`${inputClass} pl-10 pr-10`}
          />
        </div>

        <PostalCodesEditor
          postalCodes={postalCodes}
          onChange={setPostalCodes}
          primaryPostcode={primaryPostcode}
          labelClass={labelClass}
        />

        <div>
          <label htmlFor="request-message" className={labelClass}>
            Message (optionnel)
          </label>
          <textarea
            id="request-message"
            className={`${inputClass} min-h-[88px] resize-y`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Précisions sur le secteur, vos contraintes…"
          />
        </div>

        <button
          type="button"
          className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:self-start"
          style={{ padding: '10px 20px', fontSize: 14, borderRadius: 10 }}
          onClick={() => void submit()}
          disabled={submitting}
        >
          {submitting ? 'Envoi…' : 'Demander ce secteur'}
        </button>
      </div>

      {!loadingRequests && pendingRequests.length > 0 ? (
        <div className="mt-8">
          <p className={labelClass}>Vos demandes en cours</p>
          <ul className="mt-2 space-y-2">
            {pendingRequests.map((req) => (
              <li
                key={req.id}
                className="rounded-xl border border-black/[0.08] bg-soft-warm/30 px-4 py-3 text-sm"
              >
                <p className="font-medium text-ink">{req.agency_name}</p>
                <p className="mt-0.5 text-mute tabular-nums">{req.codes_postaux.join(', ')}</p>
                <p className="mt-1 text-xs font-medium text-accent-dark">
                  {STATUS_LABEL[req.status]}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!loadingRequests && requests.some((r) => r.status !== 'en_attente') ? (
        <div className="mt-4">
          <p className="text-xs text-mute">Historique</p>
          <ul className="mt-1 space-y-1">
            {requests
              .filter((r) => r.status !== 'en_attente')
              .map((req) => (
                <li key={req.id} className="text-xs text-mute">
                  {req.agency_name} — {STATUS_LABEL[req.status]}
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
