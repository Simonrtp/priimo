'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import AddressAutocomplete, { type SelectedAddress } from '@/components/AddressAutocomplete';
import Footer from '@/components/Footer';
import { PriimoLogo } from '@/components/brand/PriimoLogo';
import { isValidFrenchPostcode, normalizeFrenchPostcode } from '@/lib/agency-postal-codes';
import { isValidFrenchPhone, normalizeFrenchPhone } from '@/lib/phone';
import type { AgencyRow } from '@/types/database';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const labelClass = 'block text-sm font-medium tracking-wide mb-1.5 text-gray-900';
const inputClass =
  'w-full rounded-xl border bg-white border-black/10 text-gray-900 placeholder-gray-500/70 px-4 py-3 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15';

interface OnboardingFormProps {
  agency: AgencyRow;
  userEmail: string;
}

function initialPostalCodes(agency: AgencyRow): string[] {
  if (agency.codes_postaux?.length) return [...agency.codes_postaux];
  return [];
}

function hasValidCoordinates(address: SelectedAddress | null): boolean {
  if (!address) return false;
  const { latitude, longitude } = address;
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    !(latitude === 0 && longitude === 0)
  );
}

export default function OnboardingForm({ agency, userEmail }: OnboardingFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(agency.name);
  const [phone, setPhone] = useState(agency.phone ?? '');
  const [email, setEmail] = useState(agency.email ?? userEmail);
  const [agencyAddress, setAgencyAddress] = useState<SelectedAddress | null>(() =>
    agency.address
      ? {
          label: agency.address,
          latitude: agency.latitude ?? 0,
          longitude: agency.longitude ?? 0,
          city: '',
          postcode: agency.codes_postaux?.[0] ?? '',
        }
      : null,
  );
  const [postalCodes, setPostalCodes] = useState<string[]>(() => initialPostalCodes(agency));
  const [extraCodeInput, setExtraCodeInput] = useState('');

  const primaryPostcode = agencyAddress?.postcode?.trim() || postalCodes[0] || null;

  const handleAddressChange = (selected: SelectedAddress | null) => {
    setAgencyAddress(selected);
    if (selected?.postcode && isValidFrenchPostcode(selected.postcode)) {
      setPostalCodes([normalizeFrenchPostcode(selected.postcode)]);
    } else if (!selected) {
      setPostalCodes([]);
    }
    setError(null);
  };

  const addExtraPostalCode = () => {
    const code = normalizeFrenchPostcode(extraCodeInput);
    if (!isValidFrenchPostcode(code)) {
      setError('Code postal invalide (5 chiffres).');
      return;
    }
    if (postalCodes.includes(code)) {
      setExtraCodeInput('');
      return;
    }
    setPostalCodes((prev) => [...prev, code].sort());
    setExtraCodeInput('');
    setError(null);
  };

  const removePostalCode = (code: string) => {
    if (postalCodes.length <= 1) return;
    setPostalCodes((prev) => prev.filter((c) => c !== code));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Le nom de l'agence est requis.");
      return;
    }
    if (!phone.trim()) {
      setError('Le téléphone est requis.');
      return;
    }
    if (!isValidFrenchPhone(phone)) {
      setError('Format de téléphone invalide (ex. 06 12 34 56 78).');
      return;
    }
    const emailTrimmed = email.trim().toLowerCase();
    if (!emailTrimmed) {
      setError("L'email est requis.");
      return;
    }
    if (!EMAIL_REGEX.test(emailTrimmed)) {
      setError("Format d'email invalide.");
      return;
    }
    if (!agencyAddress?.label?.trim()) {
      setError("Sélectionnez l'adresse de l'agence dans la liste de suggestions.");
      return;
    }
    if (!agencyAddress.postcode || !isValidFrenchPostcode(agencyAddress.postcode)) {
      setError("Impossible de déduire le code postal — choisissez une adresse dans la liste.");
      return;
    }
    if (!hasValidCoordinates(agencyAddress)) {
      setError('Adresse invalide : choisissez une adresse dans la liste de suggestions.');
      return;
    }
    if (postalCodes.length === 0) {
      setError('Au moins un code postal de secteur est requis.');
      return;
    }

    setError(null);
    setSubmitting(true);

    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        phone: normalizeFrenchPhone(phone),
        email: emailTrimmed,
        address: agencyAddress.label.trim(),
        latitude: agencyAddress.latitude,
        longitude: agencyAddress.longitude,
        codesPostaux: postalCodes,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setSubmitting(false);

    if (!res.ok) {
      const message = data.error ?? 'Une erreur est survenue.';
      setError(message);
      toast.error(`Erreur : ${message}`);
      return;
    }

    toast.success('Configuration terminée !');
    router.push('/dashboard');
    router.refresh();
  };

  return (
    <main className="min-h-dvh bg-canvas flex flex-col">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background: [
            'radial-gradient(900px 700px at 18% 22%, rgba(232, 116, 60, 0.07), transparent 65%)',
            'radial-gradient(820px 620px at 84% 70%, rgba(232, 116, 60, 0.055), transparent 65%)',
          ].join(', '),
        }}
      />

      <header className="flex-shrink-0 px-4 pt-6 pb-4 sm:px-6">
        <div className="mx-auto w-full max-w-[480px]">
          <Link href="/" className="inline-block">
            <PriimoLogo className="h-10" priority />
          </Link>
          <p className="mt-4 text-sm text-gray-600">Configuration de votre espace directeur</p>
        </div>
      </header>

      <div className="flex-1 px-4 pb-8 sm:px-6">
        <div className="mx-auto w-full max-w-[480px] rounded-2xl border border-black/5 bg-white p-6 shadow-soft sm:p-8">
          <form onSubmit={handleSubmit} noValidate>
            <h1 className="font-sans text-xl font-semibold text-gray-900 tracking-tight">
              Informations agence
            </h1>
            <p className="mt-1.5 text-sm text-gray-600">
              Complétez les informations de votre agence et définissez vos secteurs de prospection.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="agency-name" className={labelClass}>
                  Nom de l&apos;agence
                </label>
                <input
                  id="agency-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  autoComplete="organization"
                />
              </div>

              <div>
                <label htmlFor="agency-address" className={labelClass}>
                  Adresse de l&apos;agence
                </label>
                <AddressAutocomplete
                  id="agency-address"
                  value={agencyAddress?.label ?? ''}
                  onChange={handleAddressChange}
                  placeholder="Ex : 12 rue de la Paix, Paris"
                  required
                  inputClassName={`${inputClass} pl-10 pr-10`}
                />
                {primaryPostcode ? (
                  <p className="mt-2 text-sm font-medium text-accent-dark">
                    Secteur : <span className="tabular-nums">{primaryPostcode}</span>
                  </p>
                ) : null}
              </div>

              {postalCodes.length > 0 && (
                <div>
                  <p className={labelClass}>Secteurs couverts</p>
                  <p className="mb-2 text-xs text-gray-600">
                    Le code postal de votre agence est pré-rempli. Ajoutez des codes postaux
                    limitrophes si besoin.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {postalCodes.map((code) => (
                      <span
                        key={code}
                        className="inline-flex items-center gap-1 rounded-lg border border-black/8 bg-soft-warm px-2.5 py-1 text-sm font-medium tabular-nums text-ink"
                      >
                        {code}
                        {postalCodes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePostalCode(code)}
                            className="ml-0.5 rounded p-0.5 text-mute hover:bg-black/5 hover:text-ink"
                            aria-label={`Retirer ${code}`}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={5}
                      value={extraCodeInput}
                      onChange={(e) => setExtraCodeInput(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addExtraPostalCode();
                        }
                      }}
                      placeholder="Ex : 75006"
                      className={`${inputClass} flex-1`}
                      aria-label="Ajouter un code postal"
                    />
                    <button
                      type="button"
                      onClick={addExtraPostalCode}
                      className="btn btn-ghost shrink-0 min-h-[48px] px-4"
                    >
                      Ajouter
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="agency-phone" className={labelClass}>
                  Téléphone
                </label>
                <input
                  id="agency-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01 23 45 67 89"
                  className={inputClass}
                  autoComplete="tel"
                />
              </div>
              <div>
                <label htmlFor="agency-email" className={labelClass}>
                  Email
                </label>
                <input
                  id="agency-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  autoComplete="email"
                />
              </div>
            </div>

            {error && (
              <p className="mt-4 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary mt-8 w-full min-h-[48px] disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: '#E8743C' }}
            >
              {submitting ? (
                <>
                  <span className="spinner" aria-hidden />
                  <span>Enregistrement…</span>
                </>
              ) : (
                <span>Terminer l&apos;onboarding</span>
              )}
            </button>
          </form>
        </div>
      </div>
      <Footer />
    </main>
  );
}
