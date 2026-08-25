'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mail, Phone, X } from 'lucide-react';
import type { Bien } from '@/types/bien';
import { bienIsActive } from '@/types/bien';
import type { Contact, ContactInteraction } from '@/types/contact';
import {
  CONTACT_TYPE_LABELS,
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-black/[0.06] px-5 py-5 sm:px-7 sm:py-6">
      <h3
        className="mb-4 font-semibold uppercase text-text-subtle"
        style={{ fontSize: 11, letterSpacing: '0.08em' }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
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

export default function ContactDetailPanel({
  contact,
  biens,
  members,
  currentUserId,
  onClose,
  onEdit,
  onDelete,
  onAssigned,
}: {
  contact: Contact;
  biens: Bien[];
  members: readonly AssigneeOption[];
  currentUserId: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAssigned: (contact: Contact) => void;
}) {
  const [interactions, setInteractions] = useState<ContactInteraction[] | null>(null);
  const [draft, setDraft] = useState('');
  const [noteAssignee, setNoteAssignee] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

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

  const panel = (
    <>
      <div
        className="fixed inset-0 z-40 bg-[rgba(21,32,47,0.35)]"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[520px] flex-col overflow-y-auto bg-surface shadow-clay-lg"
        role="dialog"
        aria-modal="true"
        aria-label={`Fiche de ${contact.fullName}`}
      >
        <header className="flex items-start justify-between gap-3 px-5 pb-5 pt-6 sm:gap-4 sm:px-7 sm:pb-6 sm:pt-7">
          <div className="min-w-0">
            <h2
              className="text-balance break-words text-[21px] font-semibold tracking-tight text-text-strong sm:text-[26px]"
              style={{ letterSpacing: '-0.02em', lineHeight: 1.2 }}
            >
              {contact.fullName}
            </h2>
            <p className="mt-1.5 text-[13.5px] text-text-muted sm:text-[14px]">
              {CONTACT_TYPE_LABELS[contact.type]}
              {contact.secteur ? ` · ${contact.secteur}` : ''}
            </p>
            {contact.address ? (
              <p className="mt-1 text-pretty text-[13px] text-text-subtle">{contact.address}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fiche"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-text-subtle transition-colors hover:bg-black/[0.04] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-2.5 px-5 pb-5 sm:gap-3 sm:px-7 sm:pb-6">
          {contact.phone ? (
            <WorkspaceButton
              type="button"
              onClick={() => {
                window.location.href = `tel:${contact.phone?.replace(/\s+/g, '')}`;
              }}
              className="min-w-0 max-w-full"
            >
              <Phone size={16} strokeWidth={2} className="flex-shrink-0" aria-hidden />
              {/* Le prénom suffit quand la place manque : le nom complet est juste au-dessus. */}
              <span className="truncate sm:hidden">Appeler</span>
              <span className="hidden truncate sm:inline">Appeler {contact.fullName}</span>
            </WorkspaceButton>
          ) : null}
          <WorkspaceButton type="button" variant="secondary" onClick={onEdit}>
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

        <Section title="Assigner à">
          <AssigneeSelect
            id="contact-detail-assignee"
            value={contact.assignedTo}
            members={members}
            currentUserId={currentUserId}
            includeUnassigned
            onChange={(id) => void assignContact(id)}
          />
        </Section>

        <Section title="Coordonnées">
          {contact.phone || contact.email ? (
            <ul className="flex flex-col gap-3">
              {contact.phone ? (
                <li className="flex items-center gap-3">
                  <Phone size={16} strokeWidth={2} className="flex-shrink-0 text-text-subtle" aria-hidden />
                  <a
                    href={`tel:${contact.phone.replace(/\s+/g, '')}`}
                    className="text-text hover:underline"
                    style={{ fontSize: 15 }}
                  >
                    {contact.phone}
                  </a>
                </li>
              ) : null}
              {contact.email ? (
                <li className="flex items-center gap-3">
                  <Mail size={16} strokeWidth={2} className="flex-shrink-0 text-text-subtle" aria-hidden />
                  <a
                    href={`mailto:${contact.email}`}
                    className="break-all text-text hover:underline"
                    style={{ fontSize: 15 }}
                  >
                    {contact.email}
                  </a>
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="text-text-subtle" style={{ fontSize: 14 }}>
              Aucune coordonnée renseignée.
            </p>
          )}
        </Section>

        {typeUsesCriteria(contact.type) ? (
          <Section title="Ce qu'il recherche">
            {criteriaAreEmpty(contact.criteria) ? (
              <p className="text-text-subtle" style={{ fontSize: 14 }}>
                Aucun critère renseigné. Sans critères, aucun rapprochement ne peut être proposé.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {criteria.map((line) => (
                  <li key={line} className="text-text" style={{ fontSize: 15 }}>
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        ) : null}

        {contact.type === 'acquereur' ? (
          <Section title="Biens qui correspondent">
            {rapprochements.length === 0 ? (
              <p className="text-text-subtle" style={{ fontSize: 14 }}>
                Aucun bien de l&apos;agence ne correspond pour l&apos;instant.
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {rapprochements.map(({ bien, match }) => (
                  <li key={bien.id}>
                    <p className="font-medium text-text-strong" style={{ fontSize: 15 }}>
                      {bien.address}
                    </p>
                    <p className="mt-0.5 text-text-muted" style={{ fontSize: 13 }}>
                      {match.raisons.join(' · ')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        ) : null}

        {contact.summary ? (
          <Section title="Résumé">
            <p className="whitespace-pre-wrap text-text" style={{ fontSize: 15, lineHeight: 1.65 }}>
              {contact.summary}
            </p>
          </Section>
        ) : null}

        <Section title="Notes terrain">
          <NotesTerrainList
            entiteType="contact"
            entiteId={contact.id}
            currentUserId={currentUserId}
          />
        </Section>

        <Section title="Historique">
          <div className="mb-5">
            <label htmlFor="contact-note" className="sr-only">
              Ajouter un échange
            </label>
            <TextArea
              id="contact-note"
              rows={3}
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
                      id="contact-note-assignee"
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
          </div>

          {interactions === null ? (
            <p className="text-text-subtle" style={{ fontSize: 14 }}>
              Chargement…
            </p>
          ) : interactions.length === 0 ? (
            <p className="text-text-subtle" style={{ fontSize: 14 }}>
              Aucun échange enregistré pour le moment.
            </p>
          ) : (
            <ul className="flex flex-col gap-5">
              {interactions.map((it) => (
                <li key={it.id}>
                  <p className="text-text-subtle" style={{ fontSize: 12 }}>
                    {INTERACTION_KIND_LABELS[it.kind]} · {formatDate(it.occurredAt)}
                  </p>
                  <p
                    className="mt-1 whitespace-pre-wrap text-text"
                    style={{ fontSize: 14.5, lineHeight: 1.6 }}
                  >
                    {it.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <div className="px-5 pb-8 pt-4 sm:px-7">
          <p className="text-text-subtle" style={{ fontSize: 12 }}>
            Contact créé le {formatDate(contact.createdAt)}
          </p>
        </div>
      </aside>
    </>
  );

  if (!mounted) return null;
  return createPortal(panel, document.body);
}
