import type { Metadata } from 'next';
import Link from 'next/link';
import AuthShell from '@/components/auth/AuthShell';
import NouveauMotDePasseForm from './NouveauMotDePasseForm';

export const metadata: Metadata = {
  title: 'Nouveau mot de passe · Priimo',
  robots: { index: false, follow: false },
  // Le jeton est dans l'adresse : il ne part chez personne d'autre.
  referrer: 'no-referrer',
};

export default async function NouveauMotDePassePage({
  searchParams,
}: {
  searchParams: Promise<{ jeton?: string }>;
}) {
  const { jeton } = await searchParams;

  if (!jeton) {
    return (
      <AuthShell
        titre="Lien incomplet"
        sousTitre="Ce lien ne permet pas de changer de mot de passe. Demandez-en un nouveau : il arrive en quelques secondes."
      >
        <Link href="/mot-de-passe/oublie" className="btn btn-primary w-full">
          Recevoir un nouveau lien
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell titre="Choisissez un nouveau mot de passe" sousTitre="Au moins 8 caractères. Vous serez connecté juste après.">
      <NouveauMotDePasseForm jeton={jeton} />
    </AuthShell>
  );
}
