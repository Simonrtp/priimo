'use client';

import { useId, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';

type Props = {
  token: string;
  agencyName: string;
  agentPrenom: string;
  infoText: string;
  consentText: string;
};

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  const errId = `${id}-err`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-[#3A4553]">
        {label}
      </label>
      {children}
      {error ? (
        <p id={errId} className="mt-1.5 text-[13px] text-[#C4483C]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function QrConsentForm({ token, agencyName, agentPrenom, infoText, consentText }: Props) {
  const prenomId = useId();
  const nomId = useId();
  const telId = useId();
  const mailId = useId();
  const consentId = useId();
  const formErrId = useId();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<'firstName' | 'lastName' | 'phone' | 'email' | 'consent' | 'form', string>>>({});

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
        const timer = window.setTimeout(() => resolve({ latitude: null, longitude: null, gpsPrecisionM: null }), 1800);
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
          email: email.trim() || null,
          consentGiven: consent,
          consentText,
          ...coords,
        }),
      });
      const data = (await res.json()) as { error?: string; field?: string | null; agentPrenom?: string };
      if (!res.ok) {
        const field = data.field;
        if (field === 'phone' || field === 'email' || field === 'consent' || field === 'lastName' || field === 'firstName') {
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
      <div className="flex min-h-dvh flex-col justify-center px-6 py-16 text-center">
        <p className="font-display text-[28px] font-semibold text-balance text-[#15202F]">C’est noté.</p>
        <p className="mx-auto mt-3 max-w-[22rem] text-pretty text-[16px] leading-relaxed text-[#3A4553]">
          {agentPrenom} a vos coordonnées. Vous pourrez lui demander à tout moment de les corriger ou de les
          supprimer.
        </p>
      </div>
    );
  }

  const infoParagraphs = infoText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10 pt-8">
      <p className="font-brand text-[15px] italic text-[#3D5A80]">{agencyName}</p>
      <h1 className="mt-3 text-balance font-display text-[26px] font-semibold leading-tight text-[#15202F]">
        Laissez vos coordonnées à {agentPrenom}
      </h1>
      <p className="mt-2 text-pretty text-[14.5px] leading-relaxed text-[#5A6573]">
        Rien n’est déjà rempli. Vous choisissez ce que vous donnez.
      </p>

      <form className="mt-8 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field id={prenomId} label="Prénom" error={errors.firstName}>
            <input
              id={prenomId}
              name="firstName"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoFocus
              aria-invalid={Boolean(errors.firstName)}
              aria-describedby={errors.firstName ? `${prenomId}-err` : undefined}
              className="min-h-12 w-full rounded-xl border border-black/10 bg-white px-3 text-[16px] text-[#15202F] outline-none focus-visible:border-[#E8743C]/50 focus-visible:ring-2 focus-visible:ring-[#E8743C]/20"
            />
          </Field>
          <Field id={nomId} label="Nom" error={errors.lastName}>
            <input
              id={nomId}
              name="lastName"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              aria-invalid={Boolean(errors.lastName)}
              aria-describedby={errors.lastName ? `${nomId}-err` : undefined}
              className="min-h-12 w-full rounded-xl border border-black/10 bg-white px-3 text-[16px] text-[#15202F] outline-none focus-visible:border-[#E8743C]/50 focus-visible:ring-2 focus-visible:ring-[#E8743C]/20"
            />
          </Field>
        </div>
        <Field id={telId} label="Téléphone" error={errors.phone}>
          <input
            id={telId}
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? `${telId}-err` : undefined}
            className="min-h-12 w-full rounded-xl border border-black/10 bg-white px-3 text-[16px] text-[#15202F] outline-none focus-visible:border-[#E8743C]/50 focus-visible:ring-2 focus-visible:ring-[#E8743C]/20"
          />
        </Field>
        <Field id={mailId} label="Email (facultatif)" error={errors.email}>
          <input
            id={mailId}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? `${mailId}-err` : undefined}
            className="min-h-12 w-full rounded-xl border border-black/10 bg-white px-3 text-[16px] text-[#15202F] outline-none focus-visible:border-[#E8743C]/50 focus-visible:ring-2 focus-visible:ring-[#E8743C]/20"
          />
        </Field>

        <div className="rounded-2xl bg-white/70 px-4 py-3 text-[13px] leading-relaxed text-[#3A4553]">
          {infoParagraphs.map((p) => (
            <p key={p.slice(0, 24)} className="mt-2 first:mt-0 text-pretty">
              {p.split(/(https?:\/\/[^\s]+)/g).map((bit, i) =>
                bit.startsWith('http') ? (
                  <Link key={i} href={bit} className="text-[#3D5A80] underline underline-offset-2">
                    vos droits
                  </Link>
                ) : (
                  bit
                ),
              )}
            </p>
          ))}
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white px-3 py-3">
          <input
            id={consentId}
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            aria-invalid={Boolean(errors.consent)}
            aria-describedby={errors.consent ? `${consentId}-err` : undefined}
            className="mt-1 size-5 rounded border-black/20"
            style={{ accentColor: '#E8743C' }}
          />
          <span className="text-pretty text-[14px] leading-snug text-[#15202F]">{consentText}</span>
        </label>
        {errors.consent ? (
          <p id={`${consentId}-err`} className="text-[13px] text-[#C4483C]">
            {errors.consent}
          </p>
        ) : null}

        {errors.form ? (
          <p id={formErrId} className="text-[13.5px] text-[#C4483C]" role="alert">
            {errors.form}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 min-h-12 rounded-2xl bg-[#E8743C] px-4 text-[16px] font-semibold text-white disabled:opacity-50"
        >
          {pending ? 'Envoi…' : 'Valider'}
        </button>
      </form>
    </div>
  );
}
