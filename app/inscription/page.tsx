'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Footer from '@/components/Footer';
import { PriimoLogo } from '@/components/brand/PriimoLogo';
import AddressAutocomplete, { type SelectedAddress } from '@/components/AddressAutocomplete';
import PostalCodesEditor, { postalCodesFromAddress } from '@/components/PostalCodesEditor';
import Turnstile from '@/components/estimation/parts/Turnstile';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { isValidFrenchPhone } from '@/lib/phone';
import { turnstileSiteKey } from '@/lib/turnstile';

const labelClass = 'block text-sm font-medium tracking-wide mb-1.5 text-gray-900';
const inputClass =
  'w-full rounded-xl border bg-white border-black/10 text-gray-900 placeholder-gray-500/70 px-4 py-3 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15';

export default function InscriptionPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [address, setAddress] = useState<SelectedAddress | null>(null);
  const [postalCodes, setPostalCodes] = useState<string[]>([]);
  const [acceptedCgu, setAcceptedCgu] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!e.currentTarget.reportValidity()) return;
    if (!isValidFrenchPhone(phone)) {
      setError('Format de téléphone invalide (ex. 06 12 34 56 78).');
      return;
    }
    if (!address?.label || !address.latitude || !address.longitude) {
      setError('Sélectionnez une adresse dans la liste.');
      return;
    }
    if (postalCodes.length === 0) {
      setError('Indiquez au moins un code postal.');
      return;
    }
    if (!acceptedCgu) {
      setError("Acceptez les conditions générales d'utilisation.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/inscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          password,
          agencyName,
          address: address.label,
          latitude: address.latitude,
          longitude: address.longitude,
          codesPostaux: postalCodes,
          acceptedCgu,
          turnstileToken,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Inscription impossible.');
        return;
      }
      const supabase = createSupabaseBrowserClient();
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signErr) {
        router.replace('/login');
        return;
      }
      router.replace('/dashboard');
    } catch {
      setError('Inscription impossible. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col bg-canvas">
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-[520px] rounded-clay-lg bg-white p-6 shadow-clay sm:p-8">
          <PriimoLogo className="mb-6 h-7" />
          <h1 className="text-balance text-[22px] font-semibold tracking-tight text-ink">
            Créer votre agence
          </h1>
          <p className="mt-1.5 text-pretty text-[14px] text-mute">
            Vous devenez directeur. L’agence s’ouvre tout de suite, le secteur se charge ensuite.
          </p>

          <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="insc-prenom" className={labelClass}>
                  Prénom
                </label>
                <input
                  id="insc-prenom"
                  className={inputClass}
                  autoComplete="given-name"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="insc-nom" className={labelClass}>
                  Nom
                </label>
                <input
                  id="insc-nom"
                  className={inputClass}
                  autoComplete="family-name"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="insc-email" className={labelClass}>
                Email
              </label>
              <input
                id="insc-email"
                type="email"
                className={inputClass}
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="insc-tel" className={labelClass}>
                Téléphone
              </label>
              <input
                id="insc-tel"
                type="tel"
                className={inputClass}
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="insc-mdp" className={labelClass}>
                Mot de passe
              </label>
              <input
                id="insc-mdp"
                type="password"
                className={inputClass}
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="insc-agence" className={labelClass}>
                Nom de l’agence
              </label>
              <input
                id="insc-agence"
                className={inputClass}
                required
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="insc-adresse" className={labelClass}>
                Adresse de l’agence
              </label>
              <AddressAutocomplete
                id="insc-adresse"
                value={address?.label ?? ''}
                onChange={(selected) => {
                  setAddress(selected);
                  if (selected?.postcode) {
                    setPostalCodes((prev) => postalCodesFromAddress(prev, selected.postcode));
                  }
                }}
                required
              />
            </div>

            <PostalCodesEditor
              postalCodes={postalCodes}
              onChange={setPostalCodes}
              primaryPostcode={address?.postcode ?? null}
              labelClass={labelClass}
            />

            <label className="flex items-start gap-2.5 text-[13.5px] text-ink">
              <input
                type="checkbox"
                className="mt-1 size-4 rounded border-black/20"
                checked={acceptedCgu}
                onChange={(e) => setAcceptedCgu(e.target.checked)}
              />
              <span>
                J’accepte les{' '}
                <Link href="/cgu" target="_blank" className="font-semibold underline underline-offset-2">
                  conditions générales d’utilisation
                </Link>
                .
              </span>
            </label>

            <Turnstile siteKey={turnstileSiteKey()} onToken={setTurnstileToken} action="inscription" />

            {error ? (
              <p className="text-pretty text-[13.5px] font-medium text-red-700" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-[46px] items-center justify-center rounded-clay bg-ink px-5 text-[14px] font-semibold text-white shadow-clay-sm disabled:opacity-60"
            >
              {submitting ? 'Création…' : 'Créer mon agence'}
            </button>
          </form>

          <p className="mt-5 text-center text-[13px] text-mute">
            Déjà un compte ?{' '}
            <Link href="/login" className="font-semibold text-ink underline underline-offset-2">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
      <Footer />
    </main>
  );
}
