'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Mail, Phone, Search, Upload } from 'lucide-react';
import type { Bien } from '@/types/bien';
import type { Contact, ContactType } from '@/types/contact';
import { CONTACT_TYPE_LABELS, CONTACT_TYPE_ORDER } from '@/types/contact';
import { notifyError, notifySuccess } from '@/lib/notify';
import { exportContactsCsv } from '@/lib/import/export-contacts';
import { formatPhoneDisplay, normalizePhone, telHref } from '@/lib/import/normalize';
import Select from '@/components/ui/Select';
import ConfirmModal from '@/components/ui/ConfirmModal';
import ImportWizard from '@/components/dashboard/import/ImportWizard';
import NoteCreateChooser from '@/components/dashboard/notes/NoteCreateChooser';
import PageHeader from '@/components/dashboard/workspace/PageHeader';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import WorkspaceCard from '@/components/dashboard/workspace/WorkspaceCard';
import ContactDetailPanel from './ContactDetailPanel';
import ContactFormDialog from './ContactFormDialog';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';

const SLATE = '#3D5A80';
const INK = '#1E3148';

function relativeDate(iso: string | null): string {
  if (!iso) return 'Jamais recontacté';
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return "Vu aujourd'hui";
  if (days === 1) return 'Vu hier';
  if (days < 30) return `Vu il y a ${days} jours`;
  const months = Math.round(days / 30);
  return months <= 1 ? 'Vu il y a un mois' : `Vu il y a ${months} mois`;
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr');
}

function contactMatchesQuery(contact: Contact, q: string): boolean {
  if (!q) return true;
  if (normalize(contact.fullName).includes(q)) return true;
  if (contact.email && normalize(contact.email).includes(q)) return true;
  const qDigits = q.replace(/\D/g, '');
  if (qDigits.length >= 3 && contact.phone) {
    return normalizePhone(contact.phone).includes(qDigits);
  }
  return false;
}

function ContactRow({
  contact,
  assigneeName,
  onOpen,
}: {
  contact: Contact;
  assigneeName: string | null;
  onOpen: () => void;
}) {
  const meta = [
    CONTACT_TYPE_LABELS[contact.type],
    contact.secteur,
    assigneeName,
  ].filter(Boolean);

  return (
    <li className="relative border-l-[3px] bg-[#F7F4EE] even:bg-[#EFEBE3]" style={{ borderLeftColor: SLATE }}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Ouvrir la fiche de ${contact.fullName}`}
        className="absolute inset-0 z-0 rounded-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
      />
      <div className="relative z-[1] flex items-start justify-between gap-3 px-4 py-3 pointer-events-none sm:px-5 sm:py-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h2
              className="min-w-0 truncate text-[16px] font-semibold text-text-strong sm:text-[17px]"
              style={{ letterSpacing: '-0.015em' }}
            >
              {contact.fullName}
            </h2>
            {contact.phone ? (
              <a
                href={telHref(contact.phone)}
                onClick={(e) => e.stopPropagation()}
                className="pointer-events-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1.5 font-medium tabular-nums hover:bg-black/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:min-h-0 sm:py-0.5"
                style={{ fontSize: 14, color: INK }}
                aria-label={`Appeler ${contact.fullName}`}
              >
                <Phone size={14} strokeWidth={2.2} aria-hidden />
                {formatPhoneDisplay(contact.phone)}
              </a>
            ) : null}
            {contact.email ? (
              <a
                href={`mailto:${contact.email}`}
                onClick={(e) => e.stopPropagation()}
                className="pointer-events-auto inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-lg px-1.5 font-medium hover:bg-black/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:min-h-0 sm:max-w-[220px] sm:py-0.5"
                style={{ fontSize: 14, color: INK }}
                aria-label={`Écrire à ${contact.fullName}`}
              >
                <Mail size={14} strokeWidth={2.2} aria-hidden />
                <span className="truncate">{contact.email}</span>
              </a>
            ) : null}
          </div>
          {meta.length > 0 ? (
            <p className="mt-1 truncate text-[12.5px] text-text-muted sm:text-[13px]">{meta.join(' · ')}</p>
          ) : null}
        </div>
        <span className="flex-shrink-0 pt-0.5 text-[12px] text-text-subtle sm:text-[12.5px]">
          {relativeDate(contact.lastInteractionAt)}
        </span>
      </div>
    </li>
  );
}

export default function ContactsClient({
  initialContacts,
  biens,
  initialSelectedContactId,
  members,
  currentUserId,
  isDirector,
  listFilter = null,
}: {
  initialContacts: Contact[];
  biens: Bien[];
  initialSelectedContactId: string | null;
  members: readonly AssigneeOption[];
  currentUserId: string;
  isDirector: boolean;
  listFilter?: 'sans-position' | 'vendeurs-inactifs' | null;
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const [query, setQuery] = useState('');

  // Une dictée validée crée le contact depuis la modale globale, qui vit hors de
  // cet écran et ne peut donc pas nous prévenir : elle rafraîchit le serveur.
  // Sans cette resynchronisation, la liste resterait figée sur son état initial.
  useEffect(() => {
    setContacts(initialContacts);
  }, [initialContacts]);

  const [typeFilter, setTypeFilter] = useState<ContactType | 'tous'>('tous');
  const [secteurFilter, setSecteurFilter] = useState('tous');
  const [memberFilter, setMemberFilter] = useState('tous');
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedContactId);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<Contact | null>(null);

  const secteurs = useMemo(() => {
    const set = new Set<string>();
    for (const c of contacts) if (c.secteur) set.add(c.secteur);
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [contacts]);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return contacts.filter((c) => {
      if (typeFilter !== 'tous' && c.type !== typeFilter) return false;
      if (secteurFilter !== 'tous' && c.secteur !== secteurFilter) return false;
      if (isDirector && memberFilter !== 'tous' && c.assignedTo !== memberFilter) return false;
      if (q && !contactMatchesQuery(c, q)) return false;
      if (listFilter === 'sans-position' && c.banId) return false;
      if (listFilter === 'vendeurs-inactifs') {
        if (c.type !== 'vendeur') return false;
        const t = Date.parse(c.lastInteractionAt ?? c.createdAt);
        if (Number.isFinite(t) && Date.now() - t <= 45 * 86_400_000) return false;
      }
      return true;
    });
  }, [contacts, query, typeFilter, secteurFilter, memberFilter, isDirector, listFilter]);

  const selected = contacts.find((c) => c.id === selectedId) ?? null;

  function upsert(contact: Contact) {
    setContacts((list) => {
      const idx = list.findIndex((c) => c.id === contact.id);
      if (idx === -1) return [contact, ...list];
      const next = [...list];
      next[idx] = contact;
      return next;
    });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);

    try {
      const res = await fetch(`/api/dashboard/contacts/${target.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setContacts((list) => list.filter((c) => c.id !== target.id));
      setSelectedId(null);
      notifySuccess('Contact supprimé');
    } catch {
      notifyError("Le contact n'a pas pu être supprimé");
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[980px] pt-4 max-md:pb-24 md:pt-2 lg:pt-6">
      <PageHeader
        title="Contacts"
        subtitle={
          contacts.length === 0
            ? 'Les personnes que vous rencontrez sur le terrain'
            : `${contacts.length} ${contacts.length > 1 ? 'personnes suivies' : 'personne suivie'}`
        }
        primaryAction={
          <NoteCreateChooser variant="toolbar" />
        }
        secondaryAction={
          <>
            <WorkspaceButton type="button" variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload size={16} strokeWidth={2} aria-hidden />
              Importer
            </WorkspaceButton>
            <WorkspaceButton
              type="button"
              variant="secondary"
              onClick={() => exportContactsCsv(contacts)}
            >
              <Download size={16} strokeWidth={2} aria-hidden />
              Exporter
            </WorkspaceButton>
            <WorkspaceButton
              type="button"
              variant="secondary"
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              Ajouter à la main
            </WorkspaceButton>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-end gap-3 sm:gap-4 md:mb-8">
        <div className="relative w-full min-w-0 flex-1 sm:w-auto sm:min-w-[220px]">
          <label htmlFor="contacts-search" className="sr-only">
            Rechercher un contact par nom, téléphone ou email
          </label>
          <Search
            size={16}
            strokeWidth={2}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle"
            aria-hidden
          />
          <input
            id="contacts-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un nom, un téléphone, un email"
            className="w-full rounded-xl border border-black/[0.10] bg-surface py-2.5 pl-9 pr-3 text-text outline-none transition-colors placeholder:text-text-subtle focus:border-accent/50 focus:ring-2 focus:ring-accent/15"
            style={{ fontSize: 14 }}
          />
        </div>

        <div className="min-w-0 flex-1 sm:w-[180px] sm:flex-none">
          <label
            htmlFor="contacts-type"
            className="mb-1.5 block text-[12.5px] font-medium text-text-muted"
          >
            Type
          </label>
          <Select
            id="contacts-type"
            value={typeFilter}
            onChange={(v) => setTypeFilter(v as ContactType | 'tous')}
            options={[
              { value: 'tous', label: 'Tous les types' },
              ...CONTACT_TYPE_ORDER.map((t) => ({ value: t, label: CONTACT_TYPE_LABELS[t] })),
            ]}
            aria-label="Filtrer par type"
          />
        </div>

        {isDirector && members.length > 1 ? (
          <div className="min-w-0 flex-1 sm:w-[200px] sm:flex-none">
            <label
              htmlFor="contacts-member"
              className="mb-1.5 block text-[12.5px] font-medium text-text-muted"
            >
              Membre
            </label>
            <Select
              id="contacts-member"
              value={memberFilter}
              onChange={setMemberFilter}
              options={[
                { value: 'tous', label: 'Tous les membres' },
                ...members.map((m) => ({
                  value: m.id,
                  label: m.id === currentUserId ? `${m.fullName} (moi)` : m.fullName,
                })),
              ]}
              aria-label="Filtrer par membre"
            />
          </div>
        ) : null}

        {secteurs.length > 0 ? (
          <div className="min-w-0 flex-1 sm:w-[200px] sm:flex-none">
            <label
              htmlFor="contacts-secteur"
              className="mb-1.5 block text-[12.5px] font-medium text-text-muted"
            >
              Secteur
            </label>
            <Select
              id="contacts-secteur"
              value={secteurFilter}
              onChange={setSecteurFilter}
              options={[
                { value: 'tous', label: 'Tous les secteurs' },
                ...secteurs.map((s) => ({ value: s, label: s })),
              ]}
              aria-label="Filtrer par secteur"
            />
          </div>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <WorkspaceCard className="py-12 text-center">
          <p className="text-pretty text-[14px] text-text-muted sm:text-[15px]">
            {contacts.length === 0
              ? "Aucun contact pour l'instant. Dictez une note après votre prochain rendez-vous."
              : 'Aucun contact ne correspond à cette recherche.'}
          </p>
        </WorkspaceCard>
      ) : (
        <ul className="overflow-hidden rounded-clay border border-[#1E3148]/12 shadow-clay-sm">
          {visible.map((contact) => (
            <ContactRow
              key={contact.id}
              contact={contact}
              assigneeName={
                isDirector && contact.assignedTo
                  ? (members.find((m) => m.id === contact.assignedTo)?.fullName ?? null)
                  : null
              }
              onOpen={() => setSelectedId(contact.id)}
            />
          ))}
        </ul>
      )}

      {selected ? (
        <ContactDetailPanel
          contact={selected}
          biens={biens}
          members={members}
          currentUserId={currentUserId}
          onClose={() => setSelectedId(null)}
          onEdit={() => {
            setEditing(selected);
            setFormOpen(true);
          }}
          onDelete={() => setPendingDelete(selected)}
          onAssigned={upsert}
        />
      ) : null}

      {formOpen ? (
        <ContactFormDialog
          key={editing?.id ?? 'nouveau'}
          open={formOpen}
          contact={editing}
          members={members}
          currentUserId={currentUserId}
          onClose={() => setFormOpen(false)}
          onSaved={(c) => {
            upsert(c);
            setSelectedId(c.id);
          }}
        />
      ) : null}

      <ImportWizard
        open={importOpen}
        onClose={() => setImportOpen(false)}
        kind="contacts"
        contacts={contacts}
        onImported={(created, updated) => {
          const createdContacts = created as Contact[];
          const updatedContacts = updated as Contact[];
          setContacts((list) => {
            const byId = new Map(list.map((c) => [c.id, c]));
            for (const c of updatedContacts) byId.set(c.id, c);
            const createdIds = new Set(createdContacts.map((c) => c.id));
            const rest = [...byId.values()].filter((c) => !createdIds.has(c.id));
            return [...createdContacts, ...rest];
          });
        }}
      />

      <ConfirmModal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Supprimer ce contact"
        message={`La fiche de ${pendingDelete?.fullName ?? ''} et son historique seront définitivement effacés.`}
        primaryLabel="Supprimer"
        variant="danger"
      />
    </div>
  );
}
