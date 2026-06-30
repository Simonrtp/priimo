'use client';

import { useState, useTransition } from 'react';
import { CopyButton } from '@/components/CopyButton';
import { createInvitation } from '@/lib/actions/invitations';
import type { AgencyRow } from '@/lib/types/database';

export function CreateInvitationForm({ agencies }: { agencies: Pick<AgencyRow, 'id' | 'name'>[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);
  const [role, setRole] = useState<'directeur' | 'collaborateur'>('directeur');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccessUrl(null);
    const form = e.currentTarget;
    const fd = new FormData(form);

    startTransition(async () => {
      try {
        const result = await createInvitation({
          email: String(fd.get('email') ?? ''),
          role: String(fd.get('role') ?? 'directeur') as 'directeur' | 'collaborateur',
          agencyName: String(fd.get('agencyName') ?? ''),
          agencyId: String(fd.get('agencyId') ?? '') || undefined,
        });

        if (!result.ok) {
          setError(result.error);
          return;
        }

        setSuccessUrl(result.inviteUrl);
        form.reset();
        setRole('directeur');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inattendue lors de la création.');
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-white/[0.06] bg-surface p-5"
    >
      <h2 className="text-sm font-semibold text-white">Créer une invitation</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs">
          <span className="mb-1.5 block font-medium uppercase tracking-widest text-white/40">Email</span>
          <input
            name="email"
            type="email"
            required
            className="input-dark w-full"
            placeholder="directeur@agence.fr"
          />
        </label>

        <label className="text-xs">
          <span className="mb-1.5 block font-medium uppercase tracking-widest text-white/40">Rôle</span>
          <select
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as 'directeur' | 'collaborateur')}
            className="input-dark w-full"
          >
            <option value="directeur">Directeur</option>
            <option value="collaborateur">Collaborateur</option>
          </select>
        </label>

        <label className="text-xs">
          <span className="mb-1.5 block font-medium uppercase tracking-widest text-white/40">
            {role === 'directeur' ? "Nom d'agence (nouvelle)" : "Nom d'agence (affichage)"}
          </span>
          <input
            name="agencyName"
            type="text"
            required={role === 'directeur'}
            className="input-dark w-full"
            placeholder="Century 21 Paris 15"
          />
        </label>

        {role === 'collaborateur' && (
          <label className="text-xs">
            <span className="mb-1.5 block font-medium uppercase tracking-widest text-white/40">
              Agence existante
            </span>
            <select name="agencyId" required className="input-dark w-full" defaultValue="">
              <option value="" disabled>
                Choisir…
              </option>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}

      </div>

      {error && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      {successUrl && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs">
          <p className="font-medium text-emerald-400">Invitation créée — lien prêt :</p>
          <p className="mt-1 break-all font-mono text-[11px] text-emerald-300/90">{successUrl}</p>
          <div className="mt-2.5">
            <CopyButton text={successUrl} label="Copier le lien" />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white shadow-glow transition hover:bg-indigo-400 disabled:opacity-50"
      >
        {pending ? 'Création…' : 'Créer et générer le lien'}
      </button>

      <p className="text-[11px] text-white/35">
        URL format : https://www.priimo.fr/invite?token=… (paramètre{' '}
        <code className="font-mono text-white/50">token</code> confirmé dans l&apos;app cliente)
      </p>
    </form>
  );
}
