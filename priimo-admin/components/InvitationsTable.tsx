'use client';

import { useTransition } from 'react';
import { Mail, Trash2 } from 'lucide-react';
import { Badge } from '@/components/Badge';
import { CopyButton } from '@/components/CopyButton';
import { EmptyState } from '@/components/EmptyState';
import { deleteInvitation } from '@/lib/actions/invitations';
import type { InvitationRow } from '@/lib/types/database';
import { ROLE_LABELS, buildInviteUrl, formatDate } from '@/lib/utils/format';

type Row = InvitationRow & { status: 'active' | 'expired' | 'used' };

export function InvitationsTable({ rows }: { rows: Row[] }) {
  const [pending, startTransition] = useTransition();

  function handleDelete(id: string) {
    if (!confirm('Supprimer cette invitation ?')) return;
    startTransition(async () => {
      const result = await deleteInvitation(id);
      if (!result.ok) alert(result.error ?? 'Erreur');
    });
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-surface">
      {rows.length === 0 ? (
        <EmptyState icon={Mail} title="Aucune invitation" description="Créez-en une avec le formulaire ci-dessus." />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Rôle</th>
              <th>Agence</th>
              <th>Token</th>
              <th>Créée</th>
              <th>Expire</th>
              <th>Statut</th>
              <th>Lien</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="text-white/80">{row.email}</td>
                <td className="text-white/60">{ROLE_LABELS[row.role] ?? row.role}</td>
                <td className="max-w-[140px] truncate text-white/60">{row.agency_name ?? '—'}</td>
                <td className="max-w-[90px] truncate font-mono text-[10px] text-white/40" title={row.token}>
                  {row.token.slice(0, 12)}…
                </td>
                <td className="whitespace-nowrap text-white/50">{formatDate(row.created_at)}</td>
                <td className="whitespace-nowrap text-white/50">{formatDate(row.expires_at)}</td>
                <td>
                  <Badge
                    variant={row.status === 'active' ? 'success' : row.status === 'used' ? 'muted' : 'warning'}
                  >
                    {row.status === 'active' ? 'Active' : row.status === 'used' ? 'Utilisée' : 'Expirée'}
                  </Badge>
                </td>
                <td>
                  {row.status === 'active' ? (
                    <CopyButton text={buildInviteUrl(row.token)} label="Copier" />
                  ) : (
                    <span className="text-white/25">—</span>
                  )}
                </td>
                <td>
                  {!row.used_at && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleDelete(row.id)}
                      className="rounded-lg p-1.5 text-red-400/80 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                      title="Supprimer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
