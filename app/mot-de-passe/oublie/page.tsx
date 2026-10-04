import type { Metadata } from 'next';
import Link from 'next/link';
import AuthShell from '@/components/auth/AuthShell';
import BoutonEnvoi from '@/components/auth/BoutonEnvoi';
import { LIEN_VALIDITE_LIBELLE } from '@/lib/auth/mot-de-passe';
import { demanderReinitialisation } from '../actions';

export const metadata: Metadata = {
  title: 'Mot de passe oublié · Priimo',
  robots: { index: false, follow: false },
};

const ERREURS: Record<string, string> = {
  email: 'Saisissez une adresse email valide.',
  rate: 'Trop de demandes. Réessayez dans quelques minutes.',
};

const RETOUR = (
  <Link href="/login" className="text-accent-dark font-medium hover:underline">
    Retour à la connexion
  </Link>
);

export default async function MotDePasseOubliePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; envoye?: string; erreur?: string }>;
}) {
  const { email, envoye, erreur } = await searchParams;

  if (envoye) {
    return (
      <AuthShell
        titre="Regardez vos emails"
        sousTitre={`Si un compte Priimo existe pour cette adresse, un lien vient d’y partir. Il est valable ${LIEN_VALIDITE_LIBELLE}.`}
        pied={RETOUR}
      >
        <p className="text-center text-sm text-gray-600 text-pretty">
          Rien au bout de quelques minutes ? Regardez dans les indésirables, ou{' '}
          <Link href="/mot-de-passe/oublie" className="text-accent-dark font-medium hover:underline">
            faites une nouvelle demande
          </Link>
          .
        </p>
      </AuthShell>
    );
  }

  const message = erreur ? ERREURS[erreur] ?? ERREURS.email : null;

  return (
    <AuthShell
      titre="Mot de passe oublié"
      sousTitre="Indiquez l’adresse de votre compte : nous vous envoyons un lien pour en choisir un nouveau."
      pied={RETOUR}
    >
      <form action={demanderReinitialisation} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium tracking-wide mb-1.5 text-gray-900">
            Adresse email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={email ?? ''}
            aria-invalid={Boolean(message)}
            aria-describedby={message ? 'email-error' : undefined}
            placeholder="vous@agence.fr"
            className="w-full rounded-xl border bg-white border-black/10 text-gray-900 placeholder-gray-500/70 px-4 py-3 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
          {message ? (
            <p id="email-error" className="mt-1.5 text-xs text-red-600">
              {message}
            </p>
          ) : null}
        </div>
        <BoutonEnvoi libelle="Recevoir le lien" attente="Envoi en cours" />
      </form>
    </AuthShell>
  );
}
