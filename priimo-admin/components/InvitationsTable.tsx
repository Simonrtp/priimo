'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2, Mail, Send, Trash2 } from 'lucide-react';
import { Badge } from '@/components/Badge';
import { CopyButton } from '@/components/CopyButton';
import { EmptyState } from '@/components/EmptyState';
import { deleteInvitation, resendInvitationEmail } from '@/lib/actions/invitations';
import type { InvitationRow } from '@/lib/types/database';
import { ROLE_LABELS, buildInviteUrl, formatDate } from '@/lib/utils/format';

type Row = InvitationRow & { status: 'active' | 'expired' | 'used' };

export function InvitationsTable({ rows }: { rows: Row[] }) {
  const [pending, startTransition] = useTransition();
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [resendError, setResendError] = useState<string | null>(null);

  function handleDelete(id: string) {
    if (!confirm('Supprimer cette invitation ?')) return;
    startTransition(async () => {
      const result = await deleteInvitation(id);
      if (!result.ok) alert(result.error ?? 'Erreur');
    });
  }

  function handleResend(id: string) {
    setResendError(null);
    setResendingId(id);
    startTransition(async () => {
      try {
        const result = await resendInvitationEmail(id);
        if (!result.ok) {
          setResendError(result.error);
          return;
        }
        setSentIds((prev) => new Set(prev).add(id));
      } catch (err) {
        setResendError(err instanceof Error ? err.message : "Erreur lors de l'envoi.");
      } finally {
        setResendingId(null);
      }
    });
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-surface">
      {resendError ? (
        <p className="border-b border-red-500/20 bg-red-500/10 px-5 py-2.5 text-xs text-red-400">
          Échec de la relance : {resendError}
        </p>
      ) : null}
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
              <th>Relance</th>
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
                <td className="whitespace-nowrap">
                  {row.status === 'used' ? (
                    <span className="text-white/25">—</span>
                  ) : sentIds.has(row.id) ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                      <Check className="h-3.5 w-3.5" /> Email renvoyé
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={resendingId !== null}
                      onClick={() => handleResend(row.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1.5 text-xs font-medium text-indigo-300 transition hover:border-indigo-500/50 hover:bg-indigo-500/20 disabled:opacity-50"
                      title={`Renvoyer l'email d'invitation à ${row.email}`}
                    >
                      {resendingId === row.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      {resendingId === row.id ? 'Envoi…' : "Renvoyer l'email"}
                    </button>
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
