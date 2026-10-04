'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import BoutonEnvoi from '@/components/auth/BoutonEnvoi';
import { MOT_DE_PASSE_MIN, verifierNouveauMotDePasse } from '@/lib/auth/mot-de-passe';
import { definirNouveauMotDePasse, type EtatNouveauMotDePasse } from '../actions';

const CHAMP =
  'password-field-custom-toggle w-full rounded-xl border bg-white border-black/10 text-gray-900 placeholder-gray-500/70 px-4 py-3 pr-11 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15';

export default function NouveauMotDePasseForm({ jeton }: { jeton: string }) {
  const [etat, action] = useActionState<EtatNouveauMotDePasse, FormData>(definirNouveauMotDePasse, null);
  const [visible, setVisible] = useState(false);
  const [erreurLocale, setErreurLocale] = useState<string | null>(null);

  const erreur = erreurLocale ?? etat?.erreur ?? null;

  return (
    <form
      action={action}
      onSubmit={(e) => {
        const data = new FormData(e.currentTarget);
        const invalide = verifierNouveauMotDePasse(
          String(data.get('motDePasse') ?? ''),
          String(data.get('confirmation') ?? ''),
        );
        setErreurLocale(invalide);
        if (invalide) e.preventDefault();
      }}
      noValidate
      className="space-y-4"
    >
      <input type="hidden" name="jeton" value={jeton} />

      <div>
        <label htmlFor="motDePasse" className="block text-sm font-medium tracking-wide mb-1.5 text-gray-900">
          Nouveau mot de passe
        </label>
        <div className="relative">
          <input
            id="motDePasse"
            name="motDePasse"
            type={visible ? 'text' : 'password'}
            autoComplete="new-password"
            minLength={MOT_DE_PASSE_MIN}
            required
            autoFocus
            placeholder={`${MOT_DE_PASSE_MIN} caractères minimum`}
            aria-invalid={Boolean(erreur)}
            aria-describedby={erreur ? 'mot-de-passe-erreur' : undefined}
            className={CHAMP}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:text-gray-900 hover:bg-soft-gray transition"
            aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          >
            {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="confirmation" className="block text-sm font-medium tracking-wide mb-1.5 text-gray-900">
          Confirmez-le
        </label>
        <input
          id="confirmation"
          name="confirmation"
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          required
          aria-invalid={Boolean(erreur)}
          aria-describedby={erreur ? 'mot-de-passe-erreur' : undefined}
          className={CHAMP}
        />
        {erreur ? (
          <p id="mot-de-passe-erreur" role="alert" className="mt-1.5 text-xs text-red-600">
            {erreur}{' '}
            {etat?.lienExpire && !erreurLocale ? (
              <Link href="/mot-de-passe/oublie" className="font-medium underline">
                Recevoir un nouveau lien
              </Link>
            ) : null}
          </p>
        ) : null}
      </div>

      <BoutonEnvoi libelle="Enregistrer et me connecter" attente="Enregistrement en cours" />
    </form>
  );
}
