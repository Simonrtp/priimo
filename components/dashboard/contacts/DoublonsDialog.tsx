'use client';

import { useMemo, useRef, useState } from 'react';
import type { Contact } from '@/types/contact';
import { CONTACT_TYPE_LABELS, rolesDuContact } from '@/types/contact';
import {
  MERGE_FIELDS,
  defaultMergeChoices,
  mergeFieldDisplay,
} from '@/lib/contacts/merge';
import { formatPhoneDisplay } from '@/lib/import/normalize';
import { notifyError, notifySuccess } from '@/lib/notify';
import Modal from '@/components/ui/Modal';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';

export type PaireDoublon = readonly [string, string];

function completude(c: Contact): number {
  return MERGE_FIELDS.filter((f) => mergeFieldDisplay(c, f.key).trim().length > 0).length;
}

function FicheDoublon({ contact, assignee }: { contact: Contact; assignee: string | null }) {
  const lignes = [
    contact.phone ? formatPhoneDisplay(contact.phone) : null,
    contact.email,
    contact.address,
    assignee,
  ].filter((v): v is string => Boolean(v));
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-[20px] border border-black/[0.08] bg-white px-4 py-3.5">
      <p className="truncate font-semibold text-text-strong" style={{ fontSize: 16, letterSpacing: '-0.01em' }}>
        {contact.fullName}
      </p>
      <p className="text-[12px] font-medium text-text-muted">
        {rolesDuContact(contact)
          .map((r) => CONTACT_TYPE_LABELS[r])
          .join(' · ')}
      </p>
      {lignes.map((l) => (
        <p key={l} className="truncate text-[13px] text-text">
          {l}
        </p>
      ))}
      {contact.summary ? (
        <p className="line-clamp-3 text-pretty text-[13px] text-text-muted">{contact.summary}</p>
      ) : null}
      {lignes.length === 0 && !contact.summary ? (
        <p className="text-[13px] text-text-muted">Fiche vide</p>
      ) : null}
    </div>
  );
}

export default function DoublonsDialog({
  paires,
  contacts,
  members,
  onClose,
  onEcarte,
  onMerged,
  onMergeFailed,
}: {
  /** Paires à passer en revue, figées à l’ouverture. */
  paires: readonly PaireDoublon[];
  contacts: readonly Contact[];
  members: readonly AssigneeOption[];
  onClose: () => void;
  onEcarte: (paire: PaireDoublon) => void;
  onMerged: (kept: Contact, absorbedId: string) => void;
  /** Si la fusion serveur échoue après la mise à jour optimiste. */
  onMergeFailed: (keptId: string, absorbed: Contact) => void;
}) {
  const [index, setIndex] = useState(0);
  const fusionEnCours = useRef(false);

  const courante = useMemo(() => {
    for (let i = index; i < paires.length; i++) {
      const a = contacts.find((c) => c.id === paires[i]![0]);
      const b = contacts.find((c) => c.id === paires[i]![1]);
      if (a && b) return { i, a, b };
    }
    return null;
  }, [paires, contacts, index]);

  if (!courante) {
    return (
      <Modal open onClose={onClose} title="Doublons" maxWidth="xl">
        <div className="flex flex-col gap-4">
          <p className="text-[14px] text-text">Tout est traité.</p>
          <div className="flex justify-end">
            <WorkspaceButton type="button" onClick={onClose}>
              Fermer
            </WorkspaceButton>
          </div>
        </div>
      </Modal>
    );
  }

  const { i, a, b } = courante;
  // On garde la fiche la plus renseignée ; l’autre lui prête ce qui manque.
  const [garde, absorbe] = completude(b) > completude(a) ? [b, a] : [a, b];
  const nomAssigne = (c: Contact) => {
    const id = c.assignedTo ?? c.createdBy;
    return members.find((m) => m.id === id)?.fullName ?? null;
  };

  function suivant() {
    setIndex(i + 1);
  }

  function ecarter() {
    onEcarte([a.id, b.id]);
    suivant();
  }

  function fusionner() {
    if (fusionEnCours.current) return;
    fusionEnCours.current = true;

    const gardeId = garde.id;
    const absorbeId = absorbe.id;
    const absorbeSnap = absorbe;
    const fields = defaultMergeChoices(garde, absorbe);

    // Optimistic : on quitte tout de suite, le toast vert part, la requête suit.
    onMerged(garde, absorbeId);
    notifySuccess(`Fiches fusionnées sous « ${garde.fullName} »`);
    onClose();

    void fetch(`/api/dashboard/contacts/${gardeId}/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ absorbId: absorbeId, fields }),
      keepalive: true,
    })
      .then(async (res) => {
        const data = (await res.json()) as { contact?: Contact; error?: string };
        if (!res.ok || !data.contact) {
          onMergeFailed(gardeId, absorbeSnap);
          notifyError(data.error ?? 'La fusion n’a pas pu aboutir');
          return;
        }
        onMerged(data.contact, absorbeId);
      })
      .catch(() => {
        onMergeFailed(gardeId, absorbeSnap);
        notifyError('La fusion n’a pas pu aboutir');
      })
      .finally(() => {
        fusionEnCours.current = false;
      });
  }

  return (
    <Modal open onClose={onClose} title={`Doublon possible · ${i + 1} sur ${paires.length}`} maxWidth="xl">
      <div className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <FicheDoublon contact={a} assignee={nomAssigne(a)} />
          <FicheDoublon contact={b} assignee={nomAssigne(b)} />
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <WorkspaceButton type="button" variant="secondary" onClick={ecarter}>
            Écarter
          </WorkspaceButton>
          <WorkspaceButton type="button" onClick={fusionner}>
            Fusionner
          </WorkspaceButton>
        </div>
        <p className="text-pretty text-[12.5px] text-text-muted">
          Fusionner garde « {garde.fullName} » et lui reporte les notes, échanges et biens de l’autre
          fiche. Écarter signale que ce ne sont pas les mêmes personnes.
        </p>
      </div>
    </Modal>
  );
}
