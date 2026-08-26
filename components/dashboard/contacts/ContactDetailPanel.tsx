'use client';

import { useEffect, useMemo, useState } from 'react';
import { Mail, Phone } from 'lucide-react';
import type { Bien } from '@/types/bien';
import { bienIsActive } from '@/types/bien';
import type { Contact, ContactInteraction } from '@/types/contact';
import {
  INTERACTION_KIND_LABELS,
  criteriaAreEmpty,
  typeUsesCriteria,
} from '@/types/contact';
import { evaluerCorrespondance } from '@/lib/matching/rapprochement';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import ActionMenu from '@/components/dashboard/workspace/ActionMenu';
import AssigneeSelect, { type AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import { TextArea } from '@/components/dashboard/workspace/Field';
import { postAgencyAlert } from '@/lib/agency/post-alert';
import { notifyError, notifySuccess } from '@/lib/notify';
import NotesTerrainList from '@/components/dashboard/notes/NotesTerrainList';
import DatePickerField from '@/components/ui/DatePickerField';
import { formatPhoneDisplay, telHref } from '@/lib/import/normalize';

function euros(v: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(v)} €`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
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
  const [interactions, setInteractions] = useState<ContactInteraction[] | null>(null);
  const [draft, setDraft] = useState('');
  const [noteAssignee, setNoteAssignee] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setInteractions(null);

    void (async () => {
      try {
        const res = await fetch(`/api/dashboard/contacts/${contact.id}/interactions`);
        const data = (await res.json()) as { interactions?: ContactInteraction[] };
        if (!cancelled) setInteractions(data.interactions ?? []);
      } catch {
        if (!cancelled) setInteractions([]);
      }
    })();

    return () => {
      cancelled = true;
    };
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

  async function addNote() {
    const text = draft.trim();
    if (!text || saving) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/contacts/${contact.id}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text, kind: 'note', assignedTo: noteAssignee }),
      });
      const data = (await res.json()) as { interaction?: ContactInteraction; error?: string };
      if (!res.ok || !data.interaction) {
        notifyError(data.error ?? "L'échange n'a pas pu être enregistré");
        return;
      }
      setInteractions((list) => [data.interaction as ContactInteraction, ...(list ?? [])]);
      setDraft('');
      setNoteAssignee(null);
    } catch {
      notifyError("L'échange n'a pas pu être enregistré");
    } finally {
      setSaving(false);
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
      const name = members.find((m) => m.id === next)?.fullName;
      notifySuccess(next ? `Fiche assignée à ${name ?? 'un collègue'}` : 'Fiche non assignée');
    } catch {
      notifyError("L'assignation n'a pas pu être enregistrée");
    } finally {
      setAssigning(false);
    }
  }

  const criteria = criteriaLines(contact);

  return (
    <div
      className="border-t border-[#1E3148]/10 px-4 pb-5 pt-4 sm:px-5"
      role="region"
      aria-label={`Fiche de ${contact.fullName}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {contact.phone ? (
          <a
            href={telHref(contact.phone)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-clay bg-accent px-3.5 text-[13px] font-semibold text-white hover:bg-accent-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Phone size={14} strokeWidth={2.2} aria-hidden />
            {formatPhoneDisplay(contact.phone)}
          </a>
        ) : null}
        {contact.email ? (
          <a
            href={`mailto:${contact.email}`}
            className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-clay border border-black/[0.10] bg-white px-3 text-[13px] font-medium text-text hover:bg-black/[0.03]"
          >
            <Mail size={14} strokeWidth={2} className="flex-shrink-0" aria-hidden />
            <span className="truncate">{contact.email}</span>
          </a>
        ) : null}
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

        {contact.address ? (
          <Block title={contact.type === 'gardien' || contact.type === 'commercant' ? 'Immeuble' : 'Adresse'}>
            <p className="text-pretty text-[14px] text-text">{contact.address}</p>
          </Block>
        ) : null}

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

      {contact.summary ? (
        <div className="mt-5">
          <Block title="Résumé">
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-text">{contact.summary}</p>
          </Block>
        </div>
      ) : null}

      <div className="mt-5 border-t border-black/[0.05] pt-4">
        <Block title="Notes terrain">
          <NotesTerrainList
            entiteType="contact"
            entiteId={contact.id}
            currentUserId={currentUserId}
          />
        </Block>
      </div>

      <div className="mt-5">
        <Block title="Historique">
          <label htmlFor={`contact-note-${contact.id}`} className="sr-only">
            Ajouter un échange
          </label>
          <TextArea
            id={`contact-note-${contact.id}`}
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ce qui vient de se dire…"
          />
          {draft.trim() ? (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              {members.length > 0 ? (
                <div className="min-w-0 flex-1">
                  <p className="mb-1.5 text-[12.5px] font-medium text-text-muted">Assigner à</p>
                  <AssigneeSelect
                    id={`contact-note-assignee-${contact.id}`}
                    value={noteAssignee}
                    members={members}
                    currentUserId={currentUserId}
                    includeUnassigned
                    onChange={setNoteAssignee}
                  />
                </div>
              ) : null}
              <WorkspaceButton type="button" onClick={addNote} disabled={saving}>
                {saving ? 'Enregistrement…' : 'Ajouter'}
              </WorkspaceButton>
            </div>
          ) : null}

          {interactions === null ? (
            <p className="mt-3 text-[13px] text-text-subtle">Chargement…</p>
          ) : interactions.length === 0 ? (
            <p className="mt-3 text-[13px] text-text-subtle">Aucun échange enregistré.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3.5">
              {interactions.map((it) => (
                <li key={it.id}>
                  <p className="text-[11.5px] text-text-subtle">
                    {INTERACTION_KIND_LABELS[it.kind]} · {formatDate(it.occurredAt)}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-text">
                    {it.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Block>
      </div>

      <p className="mt-4 text-[11.5px] text-text-subtle">Créé le {formatDate(contact.createdAt)}</p>
    </div>
  );
}
