'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Bien } from '@/types/bien';
import { bienIsActive } from '@/types/bien';
import type { Contact } from '@/types/contact';
import { criteriaAreEmpty, typeUsesCriteria } from '@/types/contact';
import { evaluerCorrespondance } from '@/lib/matching/rapprochement';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import ActionMenu from '@/components/dashboard/workspace/ActionMenu';
import AssigneeSelect, { type AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import { Field, TextArea, TextInput } from '@/components/dashboard/workspace/Field';
import { postAgencyAlert } from '@/lib/agency/post-alert';
import { notifyError } from '@/lib/notify';
import DatePickerField from '@/components/ui/DatePickerField';

function euros(v: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(v)} €`;
}

function criteriaLines(contact: Contact): string[] {
  const c = contact.criteria;
  const lines: string[] = [];

  if (c.budgetMin !== null && c.budgetMax !== null) {
    lines.push(`Budget de ${euros(c.budgetMin)} à ${euros(c.budgetMax)}`);
  } else if (c.budgetMax !== null) {
    lines.push(`Budget jusqu'à ${euros(c.budgetMax)}`);
  } else if (c.budgetMin !== null) {
    lines.push(`Budget à partir de ${euros(c.budgetMin)}`);
  }

  if (c.surfaceMin !== null && c.surfaceMax !== null) {
    lines.push(`Surface de ${c.surfaceMin} à ${c.surfaceMax} m²`);
  } else if (c.surfaceMin !== null) {
    lines.push(`Au moins ${c.surfaceMin} m²`);
  } else if (c.surfaceMax !== null) {
    lines.push(`Jusqu'à ${c.surfaceMax} m²`);
  }

  if (c.roomsMin !== null) lines.push(`Au moins ${c.roomsMin} pièces`);
  if (c.postalCodes.length > 0) lines.push(`Secteur ${c.postalCodes.join(', ')}`);

  return lines;
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
        {title}
      </h3>
      {children}
    </div>
  );
}

function payloadFrom(contact: Contact, draft: {
  summary: string;
  phone: string;
  email: string;
  address: string;
}) {
  return {
    firstName: contact.firstName,
    lastName: contact.lastName,
    type: contact.type,
    phone: draft.phone.trim() || null,
    email: draft.email.trim() || null,
    secteur: contact.secteur,
    address: draft.address.trim() || null,
    postalCodes: contact.criteria.postalCodes,
    budgetMin: contact.criteria.budgetMin,
    budgetMax: contact.criteria.budgetMax,
    surfaceMin: contact.criteria.surfaceMin,
    surfaceMax: contact.criteria.surfaceMax,
    roomsMin: contact.criteria.roomsMin,
    summary: draft.summary.trim() || null,
    recontacterLe: contact.recontacterLe,
    assignedTo: contact.assignedTo,
  };
}

function fieldSnapshot(contact: Contact) {
  return {
    summary: contact.summary ?? '',
    phone: contact.phone ?? '',
    email: contact.email ?? '',
    address: contact.address ?? '',
  };
}

function draftsEqual(
  a: { summary: string; phone: string; email: string; address: string },
  b: { summary: string; phone: string; email: string; address: string },
): boolean {
  return (
    a.summary === b.summary &&
    a.phone === b.phone &&
    a.email === b.email &&
    a.address === b.address
  );
}

export default function ContactDetailPanel({
  contact,
  biens,
  members,
  currentUserId,
  onEdit,
  onDelete,
  onAssigned,
}: {
  contact: Contact;
  biens: Bien[];
  members: readonly AssigneeOption[];
  currentUserId: string;
  onEdit: () => void;
  onDelete: () => void;
  onAssigned: (contact: Contact) => void;
}) {
  const [draft, setDraft] = useState({
    summary: contact.summary ?? '',
    phone: contact.phone ?? '',
    email: contact.email ?? '',
    address: contact.address ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const draftRef = useRef(draft);
  const lastSavedRef = useRef(fieldSnapshot(contact));
  const savingRef = useRef(false);
  const queuedRef = useRef(false);
  draftRef.current = draft;

  useEffect(() => {
    const next = fieldSnapshot(contact);
    setDraft(next);
    lastSavedRef.current = next;
  }, [contact.id]);

  const rapprochements = useMemo(() => {
    if (contact.type !== 'acquereur') return [];
    return biens
      .filter((b) => bienIsActive(b.mandatStatut))
      .map((bien) => ({
        bien,
        match: evaluerCorrespondance(
          {
            id: bien.id,
            address: bien.address,
            postalCode: bien.postalCode,
            price: bien.price,
            surfaceM2: bien.surfaceM2,
            rooms: bien.rooms,
          },
          contact,
        ),
      }))
      .filter((r): r is { bien: Bien; match: NonNullable<typeof r.match> } => r.match !== null);
  }, [biens, contact]);

  async function saveDraft() {
    if (savingRef.current) {
      queuedRef.current = true;
      return;
    }
    const current = draftRef.current;
    if (draftsEqual(lastSavedRef.current, current)) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadFrom(contact, current)),
      });
      const data = (await res.json()) as { contact?: Contact; error?: string };
      if (!res.ok || !data.contact) {
        notifyError(data.error ?? "Les informations n'ont pas pu être enregistrées");
        return;
      }
      lastSavedRef.current = current;
      onAssigned(data.contact);
    } catch {
      notifyError("Les informations n'ont pas pu être enregistrées");
    } finally {
      savingRef.current = false;
      setSaving(false);
      if (queuedRef.current) {
        queuedRef.current = false;
        void saveDraft();
      }
    }
  }

  async function assignContact(next: string | null) {
    if (assigning || next === contact.assignedTo) return;
    setAssigning(true);
    try {
      const res = await fetch(`/api/dashboard/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo: next }),
      });
      const data = (await res.json()) as { contact?: Contact; error?: string };
      if (!res.ok || !data.contact) {
        notifyError(data.error ?? "L'assignation n'a pas pu être enregistrée");
        return;
      }
      onAssigned(data.contact);
    } catch {
      notifyError("L'assignation n'a pas pu être enregistrée");
    } finally {
      setAssigning(false);
    }
  }

  const criteria = criteriaLines(contact);
  const addressLabel = contact.type === 'gardien' || contact.type === 'commercant' ? 'Immeuble' : 'Adresse';

  return (
    <div
      className="border-t border-[#1E3148]/10 px-4 pb-5 pt-5 sm:px-5"
      role="region"
      aria-busy={saving}
      aria-label={`Fiche de ${contact.fullName}`}
    >
      <div>
        <label htmlFor={`contact-note-${contact.id}`} className="sr-only">
          Note sur {contact.fullName}
        </label>
        <TextArea
          id={`contact-note-${contact.id}`}
          rows={4}
          value={draft.summary}
          onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
          onBlur={() => void saveDraft()}
          placeholder="Ce qu’il faut se rappeler de cette personne"
          className="rounded-2xl bg-white"
        />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 sm:gap-x-6">
        <Field label="Téléphone" htmlFor={`contact-phone-${contact.id}`}>
          <TextInput
            id={`contact-phone-${contact.id}`}
            type="tel"
            autoComplete="off"
            value={draft.phone}
            onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
            onBlur={() => void saveDraft()}
            placeholder="06 12 34 56 78"
          />
        </Field>
        <Field label="Email" htmlFor={`contact-email-${contact.id}`}>
          <TextInput
            id={`contact-email-${contact.id}`}
            type="email"
            autoComplete="off"
            value={draft.email}
            onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
            onBlur={() => void saveDraft()}
            placeholder="prenom@email.fr"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label={addressLabel} htmlFor={`contact-address-${contact.id}`}>
            <TextInput
              id={`contact-address-${contact.id}`}
              autoComplete="off"
              value={draft.address}
              onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
              onBlur={() => void saveDraft()}
              placeholder="12 rue de la Monnaie, Lille"
            />
          </Field>
        </div>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2 sm:gap-x-8">
        <Block title="Assigner à">
          <AssigneeSelect
            id={`contact-detail-assignee-${contact.id}`}
            value={contact.assignedTo}
            members={members}
            currentUserId={currentUserId}
            includeUnassigned
            onChange={(id) => void assignContact(id)}
          />
        </Block>

        <Block title="Relance">
          <DatePickerField
            id={`contact-detail-relance-${contact.id}`}
            value={contact.recontacterLe}
            onChange={(next) => {
              void (async () => {
                try {
                  const res = await fetch(`/api/dashboard/contacts/${contact.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recontacterLe: next }),
                  });
                  const data = (await res.json()) as { contact?: Contact; error?: string };
                  if (!res.ok || !data.contact) {
                    notifyError(data.error ?? "La date de relance n'a pas pu être enregistrée");
                    return;
                  }
                  onAssigned(data.contact);
                } catch {
                  notifyError("La date de relance n'a pas pu être enregistrée");
                }
              })();
            }}
            aria-label="Date de relance"
          />
        </Block>

        {typeUsesCriteria(contact.type) ? (
          <Block title="Ce qu'il recherche">
            {criteriaAreEmpty(contact.criteria) ? (
              <p className="text-[13.5px] text-text-subtle">Aucun critère renseigné.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {criteria.map((line) => (
                  <li key={line} className="text-[14px] text-text">
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </Block>
        ) : null}
      </div>

      {contact.type === 'acquereur' && rapprochements.length > 0 ? (
        <div className="mt-5">
          <Block title="Biens qui correspondent">
            <ul className="flex flex-col gap-2.5">
              {rapprochements.map(({ bien, match }) => (
                <li key={bien.id}>
                  <p className="text-[14px] font-medium text-text-strong">{bien.address}</p>
                  <p className="mt-0.5 text-[12.5px] text-text-muted">{match.raisons.join(' · ')}</p>
                </li>
              ))}
            </ul>
          </Block>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <WorkspaceButton type="button" variant="secondary" onClick={onEdit} className="!min-h-9 !py-1.5">
          Modifier
        </WorkspaceButton>
        <ActionMenu
          items={[
            {
              label: 'Signaler une baisse de prix',
              onSelect: () => {
                void postAgencyAlert({ kind: 'baisse_prix', contactId: contact.id });
              },
            },
            {
              label: 'Signaler un mandat à récupérer',
              onSelect: () => {
                void postAgencyAlert({ kind: 'mandat_a_recuperer', contactId: contact.id });
              },
            },
            { label: 'Supprimer ce contact', onSelect: onDelete, destructive: true },
          ]}
        />
      </div>
    </div>
  );
}
