'use client';

import Link from 'next/link';
import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Invitation = {
  role: 'directeur' | 'collaborateur';
  email: string;
  agency_name?: string | null;
};

const inputClass =
  'w-full rounded-xl border bg-white border-black/10 text-gray-900 placeholder-gray-500/70 px-4 py-3 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15';

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a19.5 19.5 0 015.06-5.94" />
      <path d="M9.9 4.24A10.94 10.94 0 0112 4c7 0 11 8 11 8a19.4 19.4 0 01-3.17 4.19" />
      <path d="M14.12 14.12a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-canvas flex items-center justify-center px-4 py-10 sm:py-16">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-canvas"
        style={{
          background: [
            'radial-gradient(1000px 800px at 12% 18%, rgba(232, 116, 60, 0.045), transparent 70%)',
            'radial-gradient(900px 700px at 88% 82%, rgba(232, 116, 60, 0.035), transparent 70%)',
            'radial-gradient(600px 500px at 50% 0%, rgba(244, 168, 122, 0.06), transparent 60%)',
          ].join(', '),
        }}
      />
      {children}
    </main>
  );
}

function InviteLoading() {
  return (
    <InviteShell>
      <div className="w-full max-w-[440px] text-center" role="status" aria-live="polite">
        <span className="spinner mx-auto mb-4 block" aria-hidden />
        <p className="text-sm text-gray-600">Validation de votre invitation…</p>
      </div>
    </InviteShell>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<InviteLoading />}>
      <InvitePageContent />
    </Suspense>
  );
}

function InvitePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [token, setToken] = useState('');
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [agencyName, setAgencyName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isDirector = invitation?.role === 'directeur';

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (!tokenParam) {
      setPageError("Token d'invitation manquant");
      setLoading(false);
      return;
    }

    setToken(tokenParam);
    void validateToken(tokenParam);
  }, [searchParams]);

  async function validateToken(tokenValue: string) {
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('token', tokenValue)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        setPageError('Invitation invalide ou expirée');
        setLoading(false);
        return;
      }

      setInvitation(data as Invitation);
      setEmail(data.email);
      if (data.agency_name) setAgencyName(data.agency_name);
      setLoading(false);
    } catch {
      setPageError('Erreur lors de la validation du token');
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      if (isDirector) await createDirectorAccount();
      else await createCollaboratorAccount();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la création du compte';
      setFormError(message);
      setSubmitting(false);
    }
  }

  async function createDirectorAccount() {
    const response = await fetch('/api/create-director', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, agencyName, firstName, lastName, email, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Erreur création compte');

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    router.push('/dashboard');
  }

  async function createCollaboratorAccount() {
    const response = await fetch('/api/create-collaborator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, firstName, lastName, email, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Erreur création compte');

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    router.push('/dashboard');
  }

  if (loading) return <InviteLoading />;

  if (pageError || !invitation) {
    return (
      <InviteShell>
        <div className="w-full max-w-[440px] rounded-2xl bg-white border border-black/5 shadow-soft p-8 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="font-sans text-xl font-semibold text-gray-900 text-balance">
              Invitation invalide
            </h1>
            <p className="mt-2 text-sm text-gray-600 text-pretty">{pageError}</p>
            <Link href="/" className="mt-6 inline-block text-sm font-medium text-accent-dark hover:underline">
              Retour à l’accueil
            </Link>
        </div>
      </InviteShell>
    );
  }

  return (
    <InviteShell>
      <div className="w-full max-w-[440px]">
        <div className="mb-6 flex justify-center">
          <Link
            href="/"
            className="font-sans text-3xl leading-none font-bold tracking-tight text-accent-dark"
          >
            Priimo
          </Link>
        </div>

        <div className="rounded-2xl bg-white border border-black/5 shadow-soft p-6 sm:p-8">
            <header className="mb-6">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-soft-warm px-3 py-1 text-xs font-medium text-accent-dark">
                <span className="size-1.5 rounded-full bg-accent" aria-hidden />
                {isDirector ? 'Étape unique — création de compte' : 'Invitation agent'}
              </div>
              <h1 className="font-sans text-2xl font-semibold text-gray-900 tracking-tight text-balance">
                {isDirector ? 'Créez votre agence' : 'Rejoignez votre équipe'}
              </h1>
              <p className="mt-2 text-sm text-gray-600 text-pretty">
                {isDirector
                  ? 'Configurez votre compte directeur Priimo'
                  : `Vous rejoignez ${invitation.agency_name || 'votre agence'}`}
              </p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {isDirector && (
                <div>
                  <label htmlFor="agency-name" className="block text-sm font-medium tracking-wide mb-1.5 text-gray-900">
                    Nom de l&apos;agence
                  </label>
                  <input
                    id="agency-name"
                    name="agencyName"
                    type="text"
                    required
                    autoComplete="organization"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="Mon Agence Immobilière"
                    className={inputClass}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="first-name" className="block text-sm font-medium tracking-wide mb-1.5 text-gray-900">
                    Prénom
                  </label>
                  <input
                    id="first-name"
                    name="firstName"
                    type="text"
                    required
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="last-name" className="block text-sm font-medium tracking-wide mb-1.5 text-gray-900">
                    Nom
                  </label>
                  <input
                    id="last-name"
                    name="lastName"
                    type="text"
                    required
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium tracking-wide mb-1.5 text-gray-900">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  readOnly
                  value={email}
                  autoComplete="email"
                  aria-readonly="true"
                  className={`${inputClass} bg-soft-gray/80 cursor-not-allowed text-gray-700`}
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  Lié à votre invitation — non modifiable
                </p>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium tracking-wide mb-1.5 text-gray-900">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 caractères"
                    aria-describedby="password-hint"
                    className={`${inputClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-9 items-center justify-center rounded-lg text-gray-500 hover:text-gray-900 hover:bg-soft-gray transition"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
                <p id="password-hint" className="mt-1.5 text-xs text-gray-500">
                  Au moins 8 caractères, lettres et chiffres recommandés
                </p>
              </div>

              {formError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary w-full disabled:cursor-wait disabled:opacity-90"
              >
                {submitting ? (
                  <>
                    <span className="spinner" aria-hidden />
                    <span>Création en cours…</span>
                  </>
                ) : (
                  <span>Créer mon compte</span>
                )}
              </button>
            </form>
          </div>

        <p className="mt-6 text-center text-xs text-gray-500 text-pretty">
          En créant votre compte, vous acceptez les conditions d’utilisation de Priimo.
        </p>
      </div>
    </InviteShell>
  );
}
