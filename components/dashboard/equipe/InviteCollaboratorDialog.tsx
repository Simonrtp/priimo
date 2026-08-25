'use client';

import { useEffect, useState } from 'react';
import { notifyError, notifySuccess } from '@/lib/notify';
import Modal from '@/components/ui/Modal';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import { Field, TextInput } from '@/components/dashboard/workspace/Field';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function InviteCollaboratorDialog({
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
    if (!open) setEmail('');
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmed)) {
      notifyError('Adresse email invalide.');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/invitations/collaborateur', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        notifyError(body.error ?? "Impossible d'envoyer l'invitation.");
        return;
      }
      notifySuccess(`Invitation envoyée à ${trimmed}`);
      onInvited();
      onClose();
    } catch {
      notifyError("Impossible d'envoyer l'invitation.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Inviter un collaborateur"
      description="Il recevra un email avec un lien pour rejoindre cette agence — pas une autre."
      maxWidth="sm"
    >
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <Field label="Adresse email" htmlFor="invite-email">
          <TextInput
            id="invite-email"
            type="email"
            autoComplete="email"
            placeholder="collegue@agence.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <WorkspaceButton type="button" variant="secondary" onClick={onClose}>
            Annuler
          </WorkspaceButton>
          <WorkspaceButton type="submit" disabled={sending || !email.trim()}>
            {sending ? 'Envoi…' : "Envoyer l'invitation"}
          </WorkspaceButton>
        </div>
      </form>
    </Modal>
  );
}
