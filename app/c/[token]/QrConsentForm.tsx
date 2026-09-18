'use client';

import { useId, useState, type FormEvent } from 'react';
import Link from 'next/link';

type Props = {
  token: string;
  agentPrenom: string;
  consentText: string;
};

const BLUE = '#3140C7';
const GREEN = '#2FCF5B';

const INPUT =
  'h-12 w-full min-w-0 rounded-lg border-0 bg-white px-3.5 text-left text-[16px] leading-normal text-[#1A1A1A] shadow-[0_2px_8px_rgba(40,70,110,0.08)] outline-none placeholder:text-[#A8B3C2] focus-visible:ring-2 focus-visible:ring-[#2FCF5B]/50';

function DrapeauFr() {
  return (
    <svg viewBox="0 0 3 2" className="h-3.5 w-[21px] rounded-[2px] outline outline-1 outline-black/10" aria-hidden>
      <rect width="1" height="2" fill="#002654" />
      <rect x="1" width="1" height="2" fill="#fff" />
      <rect x="2" width="1" height="2" fill="#ED2939" />
    </svg>
  );
}

function phoneForSubmit(local: string): string {
  const digits = local.replace(/\D/g, '');
  if (digits.startsWith('33')) return `+${digits}`;
  if (digits.startsWith('0')) return `+33${digits.slice(1)}`;
  return `+33${digits}`;
}

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
    if (pending || done) return;
    setPending(true);
    setErrors({});

    try {
      const res = await fetch(`/api/c/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          phone: phoneForSubmit(phone),
          email: null,
          consentGiven: consent,
          consentText,
          latitude: null,
          longitude: null,
          gpsPrecisionM: null,
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
      setPending(false);
    }
  }

  return (
    <div className="relative min-h-[100svh] overflow-x-hidden">
      <form
        className="flex min-h-[100svh] flex-col"
        onSubmit={onSubmit}
        noValidate
        aria-hidden={done || undefined}
      >
        <div
          className="mx-auto w-full max-w-[24rem] px-5 text-left"
          style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top, 0px))' }}
        >
          <h1
            className="qr-in pt-4 text-left text-[26px] font-bold leading-tight text-balance text-[#111]"
            style={{ animationDelay: '40ms' }}
          >
            Merci pour votre confiance <span aria-hidden>☺️</span>
          </h1>

          <div className="qr-in mt-8 grid grid-cols-2 gap-2.5" style={{ animationDelay: '120ms' }}>
            <div className="min-w-0">
              <label htmlFor={prenomId} className="sr-only">
                Prénom
              </label>
              <input
                id={prenomId}
                name="given-name"
                autoComplete="given-name"
                autoCapitalize="words"
                enterKeyHint="next"
                placeholder="Prénom"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={80}
                aria-invalid={Boolean(errors.firstName)}
                aria-describedby={errors.firstName ? `${prenomId}-err` : undefined}
                className={INPUT}
              />
              {errors.firstName ? (
                <p id={`${prenomId}-err`} className="mt-1 px-1 text-[12px] text-[#C4483C]">
                  {errors.firstName}
                </p>
              ) : null}
            </div>
            <div className="min-w-0">
              <label htmlFor={nomId} className="sr-only">
                Nom
              </label>
              <input
                id={nomId}
                name="family-name"
                autoComplete="family-name"
                autoCapitalize="words"
                enterKeyHint="next"
                placeholder="Nom"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                maxLength={80}
                aria-invalid={Boolean(errors.lastName)}
                aria-describedby={errors.lastName ? `${nomId}-err` : undefined}
                className={INPUT}
              />
              {errors.lastName ? (
                <p id={`${nomId}-err`} className="mt-1 px-1 text-[12px] text-[#C4483C]">
                  {errors.lastName}
                </p>
              ) : null}
            </div>
          </div>

          <div className="qr-in mt-2.5 min-w-0" style={{ animationDelay: '180ms' }}>
            <label htmlFor={telId} className="sr-only">
              Numéro de téléphone, France +33
            </label>
            <div
              className={`flex h-12 min-w-0 items-center gap-2 rounded-lg bg-white pl-3 pr-2 shadow-[0_2px_8px_rgba(40,70,110,0.08)] focus-within:ring-2 focus-within:ring-[#2FCF5B]/50 ${
                errors.phone ? 'ring-2 ring-[#C4483C]/50' : ''
              }`}
            >
              <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[15px] font-medium text-[#1A1A1A]">
                <DrapeauFr />
                +33
              </span>
              <input
                id={telId}
                name="tel"
                type="tel"
                autoComplete="tel-national"
                inputMode="numeric"
                enterKeyHint="done"
                placeholder="6 12 34 56 78"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                maxLength={16}
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? `${telId}-err` : undefined}
                className="h-12 min-w-0 flex-1 border-0 bg-transparent text-left text-[16px] leading-normal text-[#1A1A1A] outline-none placeholder:text-[#A8B3C2]"
              />
            </div>
            {errors.phone ? (
              <p id={`${telId}-err`} className="mt-1 px-1 text-[12px] text-[#C4483C]">
                {errors.phone}
              </p>
            ) : null}
          </div>

          <label className="qr-in mt-8 flex cursor-pointer items-start gap-3" style={{ animationDelay: '260ms' }}>
            <span className="relative mt-0.5 size-6 shrink-0">
              <input
                id={consentId}
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                aria-invalid={Boolean(errors.consent)}
                aria-describedby={errors.consent ? `${consentId}-err` : undefined}
                className="absolute inset-0 z-10 size-full cursor-pointer opacity-0"
              />
              <span
                aria-hidden
                className="pointer-events-none flex size-6 items-center justify-center rounded-full border-2 border-[#C5CDD6] bg-white"
              >
                <span
                  className="block size-3.5 rounded-full"
                  style={{
                    backgroundColor: GREEN,
                    transform: consent ? 'scale(1)' : 'scale(0)',
                    transition: 'transform 160ms ease-out',
                  }}
                />
              </span>
            </span>
            <span className="min-w-0 text-pretty text-left text-[13.5px] font-medium leading-snug text-[#3A4553]">
              {consentText}
            </span>
          </label>
          {errors.consent ? (
            <p id={`${consentId}-err`} className="mt-1.5 px-1 text-[12px] text-[#C4483C]">
              {errors.consent}
            </p>
          ) : null}
        </div>

        <div className="qr-in relative mt-10 flex min-h-0 flex-1 flex-col" style={{ animationDelay: '340ms' }}>
          <svg
            viewBox="0 0 375 56"
            preserveAspectRatio="none"
            className="relative z-[1] -mb-2 block h-14 w-full shrink-0 sm:h-16"
            aria-hidden
          >
            <path
              fill={BLUE}
              d="M0 56V22c8 0 16 20 36 22 34 4 50-16 96-22 56-8 74 28 125 28s64-28 110-28h8v34H0Z"
            />
          </svg>

          <div
            className="relative flex flex-1 flex-col items-center px-5 pt-1"
            style={{
              backgroundColor: BLUE,
              paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))',
            }}
          >
            {errors.form ? (
              <p id={formErrId} className="mb-3 text-center text-[13.5px] text-[#FECACA]" role="alert">
                {errors.form}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={pending || done}
              className="h-12 w-full max-w-[16.5rem] rounded-full text-[17px] font-bold text-white outline-none transition-transform duration-150 ease-out focus-visible:ring-2 focus-visible:ring-white/80 active:scale-[0.97] disabled:opacity-50"
              style={{ backgroundColor: GREEN, boxShadow: '0 8px 18px rgba(20,30,80,0.28)' }}
            >
              <span className={pending ? 'qr-wait' : undefined}>{pending ? 'Envoi…' : 'Valider'}</span>
            </button>
            <p className="mt-8 pb-1 text-center text-[11px] leading-relaxed text-white/90">
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

      {done ? (
        <div
          className="qr-tide fixed inset-0 z-10 flex flex-col items-center justify-center px-6 text-center"
          style={{ backgroundColor: BLUE, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          role="status"
        >
          <p
            className="qr-tide-copy text-[28px] font-bold text-balance text-white"
            style={{ animationDelay: '280ms' }}
          >
            C’est noté.
          </p>
          <p
            className="qr-tide-copy mx-auto mt-3 max-w-[20rem] text-pretty text-[15px] leading-relaxed text-white/80"
            style={{ animationDelay: '380ms' }}
          >
            {agentPrenom} a vos coordonnées. Vous pourrez lui demander à tout moment de les corriger ou de
            les supprimer.
          </p>
        </div>
      ) : null}
    </div>
  );
}
