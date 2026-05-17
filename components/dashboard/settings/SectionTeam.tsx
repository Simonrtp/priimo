'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/hooks/useUser';
import Modal from '@/components/ui/Modal';
import type { InvitationRow, ProfileRole } from '@/types/database';
import type { TeamMemberDto } from '@/app/api/team/route';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function initialsFor(firstName: string, lastName: string): string {
  return `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase() || '?';
}

function avatarBackgroundFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 50% 35%)`;
}

function roleLabel(role: ProfileRole): string {
  return role === 'directeur' ? 'Directeur' : 'Collaborateur';
}

function roleChipClass(role: ProfileRole): string {
  return role === 'directeur' ? 'bg-accent/15 text-accent-dark' : 'bg-gray-100 text-gray-700';
}

function formatDateFr(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(iso),
  );
}

export default function SectionTeam() {
  const { user, agency } = useUser();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [members, setMembers] = useState<TeamMemberDto[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<TeamMemberDto | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [teamRes, invitesRes] = await Promise.all([
        fetch('/api/team', { cache: 'no-store' }),
        supabase
          .from('invitations')
          .select('*')
          .eq('agency_id', agency.id)
          .is('used_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false }),
      ]);
      if (!teamRes.ok) {
        const body = (await teamRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'Impossible de charger l’équipe.');
      }
      const teamBody = (await teamRes.json()) as { members: TeamMemberDto[] };
      setMembers(teamBody.members);
      if (invitesRes.error) {
        throw new Error(invitesRes.error.message);
      }
      setInvitations(invitesRes.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setLoading(false);
    }
  }, [agency.id, supabase]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <section>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-semibold text-ink" style={{ fontSize: 18 }}>
          Mon équipe
        </h2>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="btn btn-primary inline-flex items-center gap-2"
          style={{ padding: '8px 16px', fontSize: 13, borderRadius: 10 }}
        >
          <UserPlus size={16} strokeWidth={2} aria-hidden />
          Inviter un collaborateur
        </button>
      </div>

      {loading && (
        <div className="rounded-xl border border-dashed border-black/10 px-4 py-8 text-center text-mute" style={{ fontSize: 13 }}>
          Chargement de l&apos;équipe…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700" style={{ fontSize: 13 }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <ul className="flex flex-col gap-2">
            {members.length === 0 && (
              <li className="rounded-xl border border-dashed border-black/10 px-4 py-6 text-center text-mute" style={{ fontSize: 13 }}>
                Aucun membre dans votre équipe.
              </li>
            )}
            {members.map((m) => {
              const canRemove = m.role !== 'directeur' && m.id !== user.id;
              const bg = avatarBackgroundFor(`${m.firstName}${m.lastName}`);
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl border border-black/[0.06] bg-white px-4 py-3"
                >
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-semibold text-white"
                    style={{ backgroundColor: bg, fontSize: 13 }}
                    aria-hidden
                  >
                    {initialsFor(m.firstName, m.lastName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink" style={{ fontSize: 14 }}>
                      {m.firstName} {m.lastName}
                    </p>
                    <p className="truncate text-mute" style={{ fontSize: 12.5 }}>
                      {m.email}
                    </p>
                  </div>
                  <span
                    className={`inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-1 font-semibold ${roleChipClass(m.role)}`}
                    style={{ fontSize: 11 }}
                  >
                    {roleLabel(m.role)}
                  </span>
                  {canRemove && (
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(m)}
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-mute transition-colors hover:bg-red-50 hover:text-red-600"
                      aria-label={`Retirer ${m.firstName} ${m.lastName}`}
                      title="Retirer"
                    >
                      <Trash2 size={16} strokeWidth={2} aria-hidden />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {invitations.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-3 font-semibold text-ink" style={{ fontSize: 15 }}>
                Invitations en attente
              </h3>
              <ul className="flex flex-col gap-2">
                {invitations.map((inv) => (
                  <InvitationRowItem key={inv.id} invitation={inv} onChanged={refresh} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={() => {
          setInviteOpen(false);
          refresh();
        }}
      />

      <ConfirmRemoveModal
        member={confirmRemove}
        onClose={() => setConfirmRemove(null)}
        onRemoved={() => {
          setConfirmRemove(null);
          refresh();
        }}
      />
    </section>
  );
}

function InvitationRowItem({
  invitation,
  onChanged,
}: {
  invitation: InvitationRow;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<'resend' | 'cancel' | null>(null);

  const handleResend = async () => {
    setBusy('resend');
    const res = await fetch(`/api/invitations/${invitation.id}/resend`, { method: 'POST' });
    setBusy(null);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(body.error ?? "Impossible de renvoyer l'invitation.");
      return;
    }
    toast.success('Invitation renvoyée');
    onChanged();
  };

  const handleCancel = async () => {
    setBusy('cancel');
    const res = await fetch(`/api/invitations/${invitation.id}`, { method: 'DELETE' });
    setBusy(null);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(body.error ?? "Impossible d'annuler l'invitation.");
      return;
    }
    toast.success('Invitation annulée');
    onChanged();
  };

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-black/[0.06] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink" style={{ fontSize: 14 }}>
          {invitation.email}
        </p>
        <p className="text-mute" style={{ fontSize: 12 }}>
          Envoyée le {formatDateFr(invitation.created_at)} — expire le {formatDateFr(invitation.expires_at)}
        </p>
      </div>
      <div className="flex flex-shrink-0 gap-2">
        <button
          type="button"
          onClick={handleResend}
          disabled={busy !== null}
          className="rounded-lg border border-black/10 bg-white px-3 py-2 font-medium text-ink transition-colors hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
          style={{ fontSize: 12.5 }}
        >
          {busy === 'resend' ? 'Envoi…' : 'Renvoyer'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={busy !== null}
          className="rounded-lg border border-black/10 bg-white px-3 py-2 font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ fontSize: 12.5 }}
        >
          {busy === 'cancel' ? 'Annulation…' : 'Annuler'}
        </button>
      </div>
    </li>
  );
}

function InviteModal({
  open,
  onClose,
  onInvited,
}: {
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) {
      setEmail('');
    }
  }, [open]);

  const submit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmed)) {
      toast.error('Adresse email invalide.');
      return;
    }
    setSending(true);
    const res = await fetch('/api/invitations/collaborateur', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmed }),
    });
    setSending(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(body.error ?? "Impossible d'envoyer l'invitation.");
      return;
    }
    toast.success(`Invitation envoyée à ${trimmed}`);
    onInvited();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Inviter un collaborateur"
      description="Il recevra un email avec un lien pour rejoindre votre agence."
      maxWidth="sm"
    >
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="invite-email" className="mb-1.5 block font-medium text-gray-700">
            Adresse email
          </label>
          <input
            id="invite-email"
            type="email"
            className="w-full rounded-lg border border-black/10 px-[14px] py-[10px] text-[14px] text-ink placeholder:text-mute/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            placeholder="collegue@agence.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 font-medium text-ink hover:bg-black/[0.04]"
            style={{ fontSize: 13 }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={sending || !email.trim()}
            className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            style={{ padding: '8px 18px', fontSize: 13, borderRadius: 10 }}
          >
            {sending ? 'Envoi…' : 'Envoyer l’invitation'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ConfirmRemoveModal({
  member,
  onClose,
  onRemoved,
}: {
  member: TeamMemberDto | null;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const [removing, setRemoving] = useState(false);

  const confirm = async () => {
    if (!member) return;
    setRemoving(true);
    const res = await fetch(`/api/team/${member.id}`, { method: 'DELETE' });
    setRemoving(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(body.error ?? 'Impossible de retirer ce membre.');
      return;
    }
    toast.success(`${member.firstName} ${member.lastName} retiré(e) de l’équipe`);
    onRemoved();
  };

  return (
    <Modal
      open={member !== null}
      onClose={onClose}
      title="Retirer un collaborateur"
      maxWidth="sm"
    >
      <p className="text-ink" style={{ fontSize: 14, lineHeight: 1.55 }}>
        Êtes-vous sûr de vouloir retirer{' '}
        <span className="font-semibold">
          {member?.firstName} {member?.lastName}
        </span>{' '}
        de votre équipe ? Cette action est irréversible.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-4 py-2 font-medium text-ink hover:bg-black/[0.04]"
          style={{ fontSize: 13 }}
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={removing}
          className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ fontSize: 13 }}
        >
          {removing ? 'Retrait…' : 'Retirer'}
        </button>
      </div>
    </Modal>
  );
}
