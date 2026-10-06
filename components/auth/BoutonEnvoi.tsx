'use client';

import { useFormStatus } from 'react-dom';
import AuthWait from '@/components/AuthWait';

/** Bouton principal d'un formulaire du parcours de connexion, avec son attente. */
export default function BoutonEnvoi({ libelle, attente }: { libelle: string; attente: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      aria-label={pending ? attente : undefined}
      className={pending ? 'priimo-wait-btn' : 'btn btn-primary w-full'}
    >
      {pending ? <AuthWait label="Un instant." /> : <span>{libelle}</span>}
    </button>
  );
}
