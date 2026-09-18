'use client';

import { useId, useState, type FormEvent } from 'react';
import Link from 'next/link';

type Props = {
  token: string;
  agentPrenom: string;
  consentText: string;
};

const PILL =
  'min-h-14 w-full rounded-full bg-white px-5 text-[16px] text-[#1A1A1A] shadow-[0_2px_10px_rgba(40,70,110,0.08)] outline-none placeholder:text-[#A8B3C2] focus-visible:ring-2 focus-visible:ring-[#2FCF5B]/45';

export default function QrConsentForm({ token, agentPrenom, consentText }: Props) {
  const prenomId = useId();
  const nomId = useId();
  const telId = useId();
  const consentId = useId();
  const formErrId = useId();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<'firstName' | 'lastName' | 'phone' | 'consent' | 'form', string>>
  >({});

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setErrors({});

    let coords: { latitude: number | null; longitude: number | null; gpsPrecisionM: number | null } = {
      latitude: null,
      longitude: null,
      gpsPrecisionM: null,
    };
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      coords = await new Promise((resolve) => {
        const timer = window.setTimeout(
          () => resolve({ latitude: null, longitude: null, gpsPrecisionM: null }),
          1800,
        );
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            window.clearTimeout(timer);
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              gpsPrecisionM: pos.coords.accuracy,
            });
          },
          () => {
            window.clearTimeout(timer);
            resolve({ latitude: null, longitude: null, gpsPrecisionM: null });
          },
          { maximumAge: 60_000, timeout: 1600, enableHighAccuracy: false },
        );
      });
    }

    try {
      const res = await fetch(`/api/c/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          phone,
          email: null,
          consentGiven: consent,
          consentText,
          ...coords,
        }),
      });
      const data = (await res.json()) as { error?: string; field?: string | null };
      if (!res.ok) {
        const field = data.field;
        if (field === 'phone' || field === 'consent' || field === 'lastName' || field === 'firstName') {
          setErrors({ [field]: data.error ?? 'Vérifiez ce champ' });
        } else {
          setErrors({ form: data.error ?? 'Impossible d’enregistrer.' });
        }
        setPending(false);
        return;
      }
      setDone(true);
    } catch {
      setErrors({ form: 'Connexion impossible. Réessayez.' });
    }
    setPending(false);
  }

  if (done) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-16 text-center">
        <p className="font-display text-[28px] font-bold text-balance text-[#111]">C’est noté.</p>
        <p className="mx-auto mt-3 max-w-[20rem] text-pretty text-[15px] leading-relaxed text-[#4A5563]">
          {agentPrenom} a vos coordonnées. Vous pourrez lui demander à tout moment de les corriger ou de
          les supprimer.
        </p>
      </div>
    );
  }

  return (
    <form className="flex min-h-dvh flex-col" onSubmit={onSubmit} noValidate>
      <div className="mx-auto w-full max-w-[22.5rem] flex-1 px-5 pt-14">
        <h1 className="text-center font-display text-[30px] font-bold leading-[1.15] text-balance text-[#111]">
          Merci pour votre confiance{' '}
          <span aria-hidden className="inline-block translate-y-px">
            ☺️
          </span>
        </h1>

        <div className="mt-12 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={prenomId} className="sr-only">
              Prénom
            </label>
            <input
              id={prenomId}
              name="firstName"
              autoComplete="given-name"
              placeholder="prénom"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoFocus
              aria-invalid={Boolean(errors.firstName)}
              aria-describedby={errors.firstName ? `${prenomId}-err` : undefined}
              className={PILL}
            />
            {errors.firstName ? (
              <p id={`${prenomId}-err`} className="mt-1.5 px-2 text-[12px] text-[#C4483C]">
                {errors.firstName}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor={nomId} className="sr-only">
              Nom
            </label>
            <input
              id={nomId}
              name="lastName"
              autoComplete="family-name"
              placeholder="Nom"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              aria-invalid={Boolean(errors.lastName)}
              aria-describedby={errors.lastName ? `${nomId}-err` : undefined}
              className={PILL}
            />
            {errors.lastName ? (
              <p id={`${nomId}-err`} className="mt-1.5 px-2 text-[12px] text-[#C4483C]">
                {errors.lastName}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mx-auto mt-5 w-[72%]">
          <label htmlFor={telId} className="sr-only">
            Numéro de téléphone
          </label>
          <input
            id={telId}
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="Num de tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? `${telId}-err` : undefined}
            className={`${PILL} text-center`}
          />
          {errors.phone ? (
            <p id={`${telId}-err`} className="mt-1.5 text-center text-[12px] text-[#C4483C]">
              {errors.phone}
            </p>
          ) : null}
        </div>

        <label className="mt-12 flex cursor-pointer items-center gap-3 px-1">
          <input
            id={consentId}
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            aria-invalid={Boolean(errors.consent)}
            aria-describedby={errors.consent ? `${consentId}-err` : undefined}
            className="size-5 shrink-0 appearance-none rounded-full border-2 border-[#C5CDD6] bg-white outline-none checked:border-[#2FCF5B] checked:bg-[#2FCF5B] focus-visible:ring-2 focus-visible:ring-[#2FCF5B]/50"
          />
          <span className="text-pretty text-[13.5px] font-medium leading-snug text-[#3A4553]">
            {consentText}
          </span>
        </label>
        {errors.consent ? (
          <p id={`${consentId}-err`} className="mt-1.5 px-1 text-[12px] text-[#C4483C]">
            {errors.consent}
          </p>
        ) : null}
      </div>

      <div className="mt-10">
        <svg
          viewBox="0 0 1440 90"
          preserveAspectRatio="none"
          className="block h-[72px] w-full"
          aria-hidden
        >
          <path
            fill="#3140C7"
            d="M0 52C120 88 240 8 420 28C600 48 660 88 840 64C1020 40 1140 4 1260 28C1340 44 1400 64 1440 52V90H0Z"
          />
        </svg>
        <div className="bg-[#3140C7] px-5 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {errors.form ? (
            <p id={formErrId} className="mb-4 text-center text-[13.5px] text-[#FECACA]" role="alert">
              {errors.form}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="mx-auto block min-h-14 w-[min(78%,18rem)] rounded-full bg-[#2FCF5B] text-[18px] font-bold text-white shadow-[0_8px_18px_rgba(20,30,80,0.28)] outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-50"
          >
            {pending ? 'Envoi…' : 'Valider'}
          </button>
          <p className="mt-8 pb-2 text-center text-[11px] leading-relaxed text-white/90">
            <span aria-hidden>🔒 </span>
            Vos données restent 100% confidentielles
            <br />
            Hébergées en France ·{' '}
            <Link href="/information" className="underline underline-offset-2">
              Respect de votre vie privée
            </Link>
          </p>
        </div>
      </div>
    </form>
  );
}
