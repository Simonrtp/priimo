'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import type { AgencyMember } from '@/lib/queries/agency-members';
import type { ProfileRole } from '@/types/database';
import { notifyError, notifySuccess } from '@/lib/notify';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Select from '@/components/ui/Select';
import PageHeader from '@/components/dashboard/workspace/PageHeader';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import WorkspaceCard from '@/components/dashboard/workspace/WorkspaceCard';
import InviteCollaboratorDialog from './InviteCollaboratorDialog';

function roleLabel(role: ProfileRole): string {
  return role === 'directeur' ? 'Directeur' : 'Collaborateur';
}

function formatDateFr(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

function countLabel(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`;
}

export default function EquipeClient({
  embedded = false,
  currentUserId,
  initialMembers,
  initialInvitations,
}: {
  embedded?: boolean;
  currentUserId: string;
  initialMembers: AgencyMember[];
  initialInvitations: {
    id: string;
    email: string;
    created_at: string;
    expires_at: string;
  }[];
}) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<AgencyMember | null>(null);
  const [pendingPromote, setPendingPromote] = useState<AgencyMember | null>(null);
  const [busy, setBusy] = useState(false);

  function refresh() {
    router.refresh();
  }

  async function confirmRemove() {
    if (!pendingRemove || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/team/${pendingRemove.id}`, { method: 'DELETE' });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        notifyError(body.error ?? 'Impossible de retirer ce membre.');
        return;
      }
      notifySuccess('Collaborateur retiré de l’agence');
      setPendingRemove(null);
      refresh();
    } catch {
      notifyError('Impossible de retirer ce membre.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmPromote() {
    if (!pendingPromote || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/team/${pendingPromote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'directeur' }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        notifyError(body.error ?? 'Le rôle n’a pas pu être modifié.');
        return;
      }
      notifySuccess(`${pendingPromote.fullName} est maintenant directeur`);
      setPendingPromote(null);
      refresh();
    } catch {
      notifyError('Le rôle n’a pas pu être modifié.');
    } finally {
      setBusy(false);
    }
  }

  async function resendInvitation(id: string) {
    const res = await fetch(`/api/invitations/${id}/resend`, { method: 'POST' });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      notifyError(body.error ?? "Impossible de renvoyer l'invitation.");
      return;
    }
    notifySuccess('Invitation renvoyée');
    refresh();
  }

  async function cancelInvitation(id: string) {
    const res = await fetch(`/api/invitations/${id}`, { method: 'DELETE' });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      notifyError(body.error ?? "Impossible d'annuler l'invitation.");
      return;
    }
    notifySuccess('Invitation annulée');
    refresh();
  }

  const memberSubtitle =
    initialMembers.length <= 1
      ? 'Les personnes qui travaillent dans cette agence'
      : `${initialMembers.length} membres dans cette agence`;

  return (
    <div
      className={
        embedded
          ? 'min-w-0'
          : 'mx-auto w-full min-w-0 max-w-[980px] pt-4 md:pt-2 lg:pt-6'
      }
    >
      {embedded ? (
        <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h2 className="font-semibold text-ink" style={{ fontSize: 18 }}>
              Mon équipe
            </h2>
            <p className="mt-1 text-pretty text-mute" style={{ fontSize: 14 }}>
              {memberSubtitle}
            </p>
          </div>
          <WorkspaceButton type="button" onClick={() => setInviteOpen(true)} className="shrink-0">
            <UserPlus size={16} strokeWidth={2} aria-hidden />
            Inviter un collaborateur
          </WorkspaceButton>
        </div>
      ) : (
        <PageHeader
          title="Mon équipe"
          subtitle={memberSubtitle}
          primaryAction={
            <WorkspaceButton type="button" onClick={() => setInviteOpen(true)}>
              <UserPlus size={16} strokeWidth={2} aria-hidden />
              Inviter un collaborateur
            </WorkspaceButton>
          }
        />
      )}

      {initialMembers.length === 0 ? (
        <WorkspaceCard className="py-12 text-center">
          <p className="text-pretty text-[14px] text-text-muted sm:text-[15px]">
            Aucun membre. Invitez un collaborateur pour qu’il rejoigne cette agence.
          </p>
        </WorkspaceCard>
      ) : (
        <ul className="flex flex-col gap-3">
          {initialMembers.map((member) => {
            const isSelf = member.id === currentUserId;
            const canEditRole = !isSelf && member.role !== 'directeur';
            const canRemove = !isSelf && member.role !== 'directeur';
            return (
              <li key={member.id}>
                <WorkspaceCard>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-[16px] font-semibold text-text-strong sm:text-[18px]"
                        style={{ letterSpacing: '-0.015em' }}
                      >
                        {member.fullName}
                        {isSelf ? ' (vous)' : ''}
                      </p>
                      {member.email ? (
                        <p className="mt-1 truncate text-[13px] text-text-muted sm:text-[13.5px]">
                          {member.email}
                        </p>
                      ) : null}
                      <p className="mt-1.5 text-[13px] tabular-nums text-text-subtle">
                        {countLabel(member.contactCount, 'contact', 'contacts')}
                        {' · '}
                        {countLabel(member.leadCount, 'lead assigné', 'leads assignés')}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {canEditRole ? (
                        <Select
                          aria-label={`Rôle de ${member.fullName}`}
                          value={member.role}
                          onChange={(value) => {
                            if (value === 'directeur') setPendingPromote(member);
                          }}
                          options={[
                            { value: 'collaborateur', label: 'Collaborateur' },
                            { value: 'directeur', label: 'Directeur' },
                          ]}
                          triggerClassName="flex min-w-[160px] items-center justify-between gap-2 rounded-xl border border-black/8 bg-white px-3 py-2 text-left text-[13px] text-ink transition-colors hover:border-black/12 focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
                        />
                      ) : (
                        <span className="rounded-full bg-black/[0.05] px-2.5 py-1 text-[12px] font-medium text-text">
                          {roleLabel(member.role)}
                        </span>
                      )}
                      {canRemove ? (
                        <WorkspaceButton
                          type="button"
                          variant="secondary"
                          onClick={() => setPendingRemove(member)}
                        >
                          Retirer
                        </WorkspaceButton>
                      ) : null}
                    </div>
                  </div>
                </WorkspaceCard>
              </li>
            );
          })}
        </ul>
      )}

      {initialInvitations.length > 0 ? (
        <div className="mt-8">
          <h2
            className="mb-3 text-balance text-[16px] font-semibold text-text-strong sm:text-[18px]"
            style={{ letterSpacing: '-0.015em' }}
          >
            Invitations en attente
          </h2>
          <ul className="flex flex-col gap-3">
            {initialInvitations.map((invitation) => (
              <li key={invitation.id}>
                <WorkspaceCard>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-text-strong">
                        {invitation.email}
                      </p>
                      <p className="mt-1 text-pretty text-[12.5px] text-text-muted">
                        Envoyée le {formatDateFr(invitation.created_at)} · expire le{' '}
                        {formatDateFr(invitation.expires_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <WorkspaceButton
                        type="button"
                        variant="secondary"
                        onClick={() => void resendInvitation(invitation.id)}
                      >
                        Renvoyer
                      </WorkspaceButton>
                      <WorkspaceButton
                        type="button"
                        variant="secondary"
                        onClick={() => void cancelInvitation(invitation.id)}
                      >
                        Annuler
                      </WorkspaceButton>
                    </div>
                  </div>
                </WorkspaceCard>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <InviteCollaboratorDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={refresh}
      />

      <ConfirmModal
        open={pendingRemove !== null}
        onClose={() => setPendingRemove(null)}
        onConfirm={() => void confirmRemove()}
        title="Retirer cet agent ?"
        message={`${pendingRemove?.fullName ?? ''} n’aura plus accès à cette agence. Ses contacts restent dans l’agence.`}
        primaryLabel="Retirer"
        variant="danger"
        isLoading={busy}
      />

      <ConfirmModal
        open={pendingPromote !== null}
        onClose={() => setPendingPromote(null)}
        onConfirm={() => void confirmPromote()}
        title="Transférer le rôle de directeur ?"
        message={`${pendingPromote?.fullName ?? ''} deviendra directeur de cette agence. Vous passerez collaborateur — un seul directeur par agence.`}
        primaryLabel="Transférer"
        variant="primary"
        isLoading={busy}
      />
    </div>
  );
}
