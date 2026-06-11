'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Footer from '@/components/Footer';
import ZoneSelector from '@/components/ZoneSelector';
import {
  agencyRowToZoneValue,
  defaultRadiusZoneValue,
  validateZoneValue,
} from '@/lib/agency-zone';
import { isValidFrenchPhone, normalizeFrenchPhone } from '@/lib/phone';
import type { AgencyRow } from '@/types/database';
import type { ZoneValue } from '@/types/zone';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const labelClass = 'block text-sm font-medium tracking-wide mb-1.5 text-gray-900';
const inputClass =
  'w-full rounded-xl border bg-white border-black/10 text-gray-900 placeholder-gray-500/70 px-4 py-3 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15';

interface OnboardingFormProps {
  agency: AgencyRow;
  userEmail: string;
}

export default function OnboardingForm({ agency, userEmail }: OnboardingFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(agency.name);
  const [phone, setPhone] = useState(agency.phone ?? '');
  const [email, setEmail] = useState(agency.email ?? userEmail);
  const [zone, setZone] = useState<ZoneValue>(
    () => agencyRowToZoneValue(agency) ?? defaultRadiusZoneValue(),
  );

  const progress = step === 1 ? 50 : 100;

  const goNext = () => {
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
    setError(null);
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const zoneError = validateZoneValue(zone);
    if (zoneError) {
      setError(zoneError);
      return;
    }
    setError(null);
    setSubmitting(true);

    const zonePayload =
      zone.type === 'postal_codes'
        ? {
            zoneType: 'postal_codes' as const,
            zonePostalCodes: zone.codes,
          }
        : {
            zoneType: 'radius' as const,
            zoneCenterAddress: zone.address,
            zoneLatitude: zone.latitude,
            zoneLongitude: zone.longitude,
            zoneRadiusKm: zone.radius_km,
          };

    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        phone: normalizeFrenchPhone(phone),
        email: email.trim().toLowerCase(),
        ...zonePayload,
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
          <Link href="/" className="font-sans text-2xl font-bold tracking-tight text-accent-dark">
            Priimo
          </Link>
          <p className="mt-4 text-sm text-gray-600">Configuration de votre espace directeur</p>

          <div className="mt-5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-medium text-mute tabular-nums">Étape {step}/2</p>
          </div>
        </div>
      </header>

      <div className="flex-1 px-4 pb-8 sm:px-6">
        <div className="mx-auto w-full max-w-[480px] rounded-2xl border border-black/5 bg-white p-6 shadow-soft sm:p-8">
          <form onSubmit={step === 2 ? handleSubmit : (e) => e.preventDefault()} noValidate>
            {step === 1 ? (
              <>
                <h1 className="font-sans text-xl font-semibold text-gray-900 tracking-tight">
                  Informations agence
                </h1>
                <p className="mt-1.5 text-sm text-gray-600">
                  Complétez les informations de base avant de définir votre zone.
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

                <button type="button" onClick={goNext} className="btn btn-primary mt-8 w-full min-h-[48px]">
                  Suivant
                </button>
              </>
            ) : (
              <>
                <h1 className="font-sans text-xl font-semibold text-gray-900 tracking-tight">
                  Zone de prospection
                </h1>
                <p className="mt-1.5 text-sm text-gray-600">
                  Définissez le périmètre dans lequel Priimo vous livrera des prospects.
                </p>

                <div className="mt-6">
                  <ZoneSelector
                    value={zone}
                    onChange={(z) => {
                      setZone(z);
                      setError(null);
                    }}
                    error={error}
                    addressInputClassName={`${inputClass} pl-10 pr-10`}
                  />
                </div>

                <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setStep(1);
                    }}
                    disabled={submitting}
                    className="btn btn-ghost w-full sm:w-auto min-h-[48px] sm:min-w-[120px]"
                  >
                    Précédent
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn btn-primary w-full flex-1 min-h-[48px] disabled:cursor-not-allowed disabled:opacity-60"
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
                </div>
              </>
            )}

            {step === 1 && error && (
              <p className="mt-4 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
          </form>
        </div>
      </div>
      <Footer />
    </main>
  );
}
