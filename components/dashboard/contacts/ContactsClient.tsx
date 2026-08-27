'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Download, Phone, Search, Trash2, Upload } from 'lucide-react';
import type { Bien } from '@/types/bien';
import { bienIsActive } from '@/types/bien';
import type { Contact, ContactType } from '@/types/contact';
import { CONTACT_TYPE_LABELS, CONTACT_TYPE_ORDER } from '@/types/contact';
import {
  civilToday,
  duplicatePartnerMap,
  isIncompleteContact,
  isRelanceDue,
  isRelanceFuture,
} from '@/lib/contacts/duplicates';
import {
  contactInitials,
  formatContactMeta,
  formatLastInteraction,
  type LatestInteraction,
} from '@/lib/contacts/display';
import type { MergeLinkCounts } from '@/lib/contacts/merge';
import { notifyError, notifySuccess } from '@/lib/notify';
import { exportContactsCsv } from '@/lib/import/export-contacts';
import { formatPhoneDisplay, normalizePhone, telHref } from '@/lib/import/normalize';
import Select from '@/components/ui/Select';
import DatePickerField from '@/components/ui/DatePickerField';
import ConfirmModal from '@/components/ui/ConfirmModal';
import ImportWizard from '@/components/dashboard/import/ImportWizard';
import PageHeader from '@/components/dashboard/workspace/PageHeader';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import WorkspaceCard from '@/components/dashboard/workspace/WorkspaceCard';
import ContactDetailPanel from './ContactDetailPanel';
import ContactFormDialog from './ContactFormDialog';
import MergeContactsDialog from './MergeContactsDialog';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';

const SLATE = '#3D5A80';
const CREAM = '#FFF7F0';

type EtatFilter = 'tous' | 'relance' | 'incompletes' | 'doublons';

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

function bienForContact(contact: Contact, biens: readonly Bien[]): Bien | null {
  const owned = biens.filter((b) => b.proprietaireContactId === contact.id);
  return owned.find((b) => bienIsActive(b.mandatStatut)) ?? owned[0] ?? null;
}

function ContactRow({
  contact,
  selected,
  assigneeName,
  last,
  bien,
  leadAddress,
  incomplete,
  duplicateOf,
  todayKey,
  biens,
  members,
  currentUserId,
  onOpen,
  onComplete,
  onMerge,
  onRelance,
  onEdit,
  onDelete,
  onAssigned,
}: {
  contact: Contact;
  selected: boolean;
  assigneeName: string | null;
  last: LatestInteraction | null;
  bien: Bien | null;
  leadAddress: string | null;
  incomplete: boolean;
  duplicateOf: string | null;
  todayKey: string;
  biens: Bien[];
  members: readonly AssigneeOption[];
  currentUserId: string;
  onOpen: () => void;
  onComplete: () => void;
  onMerge: () => void;
  onRelance: (date: string | null) => void;
  onEdit: () => void;
  onDelete: () => void;
  onAssigned: (contact: Contact) => void;
}) {
  const meta = formatContactMeta(contact, {
    assigneeName,
    mandatStatut: bien?.mandatStatut ?? null,
    bienAddress: bien?.address ?? null,
    leadAddress,
  });
  const future = isRelanceFuture(contact.recontacterLe, todayKey);
  const callableNow = Boolean(contact.phone) && !future;
  const [mounted, setMounted] = useState(selected);
  const [expanded, setExpanded] = useState(selected);

  useEffect(() => {
    if (selected) {
      setMounted(true);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setExpanded(true));
      });
      return () => cancelAnimationFrame(raf);
    }
    setExpanded(false);
    const timer = window.setTimeout(() => setMounted(false), 320);
    return () => window.clearTimeout(timer);
  }, [selected]);

  return (
    <li
      className="overflow-hidden border-b border-[#1E3148]/12 transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] first:rounded-t-[32px] last:rounded-b-[32px] last:border-b-0 motion-reduce:transition-none"
      style={{
        background: selected ? CREAM : '#FFFFFF',
        borderBottomWidth: 0.5,
      }}
    >
      <div
        className="flex min-h-[76px] cursor-pointer items-center gap-3 px-4 py-3 transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[#FFF7F0] motion-reduce:transition-none sm:px-5"
        style={selected ? { background: CREAM } : undefined}
        onClick={onOpen}
      >
        <span
          className="flex size-10 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
          style={{ background: '#EAEFF5', color: SLATE }}
        >
          {contactInitials(contact)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className="truncate font-semibold text-text-strong"
              style={{ fontSize: 15, letterSpacing: '-0.01em' }}
            >
              {contact.fullName}
            </span>
            <span
              className="inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ background: '#EAEFF5', color: SLATE }}
            >
              {CONTACT_TYPE_LABELS[contact.type]}
            </span>
            {duplicateOf ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMerge();
                }}
                className="inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{ background: '#EFEBE3', color: '#1E3148' }}
              >
                Doublon possible
              </button>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[13px] text-text-muted">{meta || '—'}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="flex flex-col items-end gap-1.5">
            <p className="text-[12px] leading-none text-text-muted">{formatLastInteraction(last)}</p>
            <div className="flex items-center gap-2">
              {callableNow && contact.phone ? (
                <a
                  href={telHref(contact.phone)}
                  className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium tabular-nums hover:bg-white/80"
                  style={{ color: SLATE }}
                  aria-label={`Appeler ${contact.fullName}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Phone size={12} strokeWidth={2.2} aria-hidden />
                  {formatPhoneDisplay(contact.phone)}
                </a>
              ) : incomplete ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onComplete();
                  }}
                  className="inline-flex h-8 items-center rounded-full px-2.5 text-[12px] font-semibold"
                  style={{ background: '#EAEFF5', color: SLATE }}
                >
                  Compléter
                </button>
              ) : null}
              <DatePickerField
                id={`relance-${contact.id}`}
                variant="compact"
                value={contact.recontacterLe}
                onChange={onRelance}
                stopPropagation
                aria-label={`Date de relance pour ${contact.fullName}`}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            aria-expanded={selected}
            aria-controls={`contact-fiche-${contact.id}`}
            aria-label={selected ? `Fermer la fiche de ${contact.fullName}` : `Ouvrir la fiche de ${contact.fullName}`}
            className="flex size-8 flex-shrink-0 items-center justify-center rounded-full text-text-subtle hover:bg-black/[0.04] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <ChevronDown
              size={16}
              strokeWidth={2}
              aria-hidden
              className={`transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
                selected ? 'rotate-180' : ''
              }`}
            />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            aria-label={`Supprimer ${contact.fullName}`}
            className="flex size-8 flex-shrink-0 items-center justify-center rounded-full text-text-subtle hover:bg-black/[0.04] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Trash2 size={15} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>

      <div
        id={`contact-fiche-${contact.id}`}
        className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className={`min-h-0 ${expanded ? 'overflow-visible' : 'overflow-hidden'}`}>
          {mounted ? (
            <ContactDetailPanel
              contact={contact}
              biens={biens}
              members={members}
              currentUserId={currentUserId}
              onEdit={onEdit}
              onDelete={onDelete}
              onAssigned={onAssigned}
            />
          ) : null}
        </div>
      </div>
    </li>
  );
}

export default function ContactsClient({
  initialContacts,
  biens,
  latestInteractions,
  leadAddresses,
  initialSelectedContactId,
  members,
  currentUserId,
  isDirector,
  listFilter = null,
  listFilterIds = [],
}: {
  initialContacts: Contact[];
  biens: Bien[];
  latestInteractions: Record<string, LatestInteraction>;
  leadAddresses: Record<string, string>;
  initialSelectedContactId: string | null;
  members: readonly AssigneeOption[];
  currentUserId: string;
  isDirector: boolean;
  listFilter?: 'sans-position' | 'vendeurs-inactifs' | 'rdv-sans-suite' | null;
  listFilterIds?: readonly string[];
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const [latest, setLatest] = useState(latestInteractions);
  const [query, setQuery] = useState('');
  const todayKey = civilToday();

  useEffect(() => {
    setContacts(initialContacts);
  }, [initialContacts]);

  useEffect(() => {
    setLatest(latestInteractions);
  }, [latestInteractions]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelectedId(null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const [typeFilter, setTypeFilter] = useState<ContactType | 'tous'>('tous');
  const [secteurFilter, setSecteurFilter] = useState('tous');
  const [memberFilter, setMemberFilter] = useState('tous');
  const [etatFilter, setEtatFilter] = useState<EtatFilter>('tous');
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedContactId);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<Contact | null>(null);
  const [mergePair, setMergePair] = useState<{ keep: Contact; absorb: Contact } | null>(null);

  const partenaires = useMemo(() => duplicatePartnerMap(contacts), [contacts]);

  const secteurs = useMemo(() => {
    const set = new Set<string>();
    for (const c of contacts) if (c.secteur) set.add(c.secteur);
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [contacts]);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    const filtered = contacts.filter((c) => {
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
      if (listFilter === 'rdv-sans-suite' && !listFilterIds.includes(c.id)) return false;
      if (etatFilter === 'relance' && !isRelanceDue(c.recontacterLe, todayKey)) return false;
      if (etatFilter === 'incompletes' && !isIncompleteContact(c)) return false;
      if (etatFilter === 'doublons' && !partenaires.has(c.id)) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      const aDue = isRelanceDue(a.recontacterLe, todayKey);
      const bDue = isRelanceDue(b.recontacterLe, todayKey);
      if (aDue !== bDue) return aDue ? -1 : 1;
      const aT = latest[a.id]?.occurredAt ?? '';
      const bT = latest[b.id]?.occurredAt ?? '';
      if (aT !== bT) return aT > bT ? -1 : 1;
      return a.fullName.localeCompare(b.fullName, 'fr');
    });
  }, [
    contacts,
    query,
    typeFilter,
    secteurFilter,
    memberFilter,
    isDirector,
    listFilter,
    listFilterIds,
    etatFilter,
    todayKey,
    partenaires,
    latest,
  ]);

  function upsert(contact: Contact) {
    setContacts((list) => {
      const idx = list.findIndex((c) => c.id === contact.id);
      if (idx === -1) return [contact, ...list];
      const next = [...list];
      next[idx] = contact;
      return next;
    });
  }

  async function patchRelance(contact: Contact, date: string | null) {
    const previous = contact.recontacterLe;
    upsert({ ...contact, recontacterLe: date });
    try {
      const res = await fetch(`/api/dashboard/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recontacterLe: date }),
      });
      const data = (await res.json()) as { contact?: Contact; error?: string };
      if (!res.ok || !data.contact) {
        upsert({ ...contact, recontacterLe: previous });
        notifyError(data.error ?? "La date de relance n'a pas pu être enregistrée");
        return;
      }
      upsert(data.contact);
    } catch {
      upsert({ ...contact, recontacterLe: previous });
      notifyError("La date de relance n'a pas pu être enregistrée");
    }
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

  function openMerge(contact: Contact) {
    const otherId = partenaires.get(contact.id);
    const other = otherId ? contacts.find((c) => c.id === otherId) : null;
    if (!other) return;
    setMergePair({ keep: contact, absorb: other });
  }

  function onMerged(kept: Contact, absorbedId: string, _transferred: MergeLinkCounts) {
    setContacts((list) => [kept, ...list.filter((c) => c.id !== kept.id && c.id !== absorbedId)]);
    setSelectedId(kept.id);
    setMergePair(null);
    void _transferred;
  }

  return (
    <div className="w-full min-w-0 px-5 pb-6 pt-2 md:px-0 md:pb-0 md:pt-1 lg:pt-3">
      <PageHeader
        title="Contacts"
        subtitle={
          contacts.length === 0
            ? 'Les personnes que vous rencontrez sur le terrain'
            : `${contacts.length} ${contacts.length > 1 ? 'personnes suivies' : 'personne suivie'}`
        }
        primaryAction={
          <WorkspaceButton
            type="button"
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
          >
            Ajouter un contact
          </WorkspaceButton>
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
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-end gap-3 sm:gap-4 md:mb-8">
        <div className="relative min-w-0 flex-[1.4] sm:min-w-[280px]">
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
            className="w-full rounded-2xl border border-black/[0.10] bg-surface py-2.5 pl-9 pr-3 text-text outline-none transition-colors placeholder:text-text-subtle focus:border-accent/50 focus:ring-2 focus:ring-accent/15"
            style={{ fontSize: 14 }}
          />
        </div>

        <div className="min-w-0 flex-1 sm:w-[180px] sm:flex-none">
          <label htmlFor="contacts-etat" className="mb-1.5 block text-[12.5px] font-medium text-text-muted">
            État
          </label>
          <Select
            id="contacts-etat"
            value={etatFilter}
            onChange={(v) => setEtatFilter(v as EtatFilter)}
            options={[
              { value: 'tous', label: 'Tous' },
              { value: 'relance', label: 'À relancer' },
              { value: 'incompletes', label: 'Fiches incomplètes' },
              { value: 'doublons', label: 'Doublons possibles' },
            ]}
            aria-label="Filtrer par état"
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
              ? 'Aucun contact pour l’instant. Ajoutez la première personne rencontrée.'
              : 'Aucun contact ne correspond à cette recherche.'}
          </p>
        </WorkspaceCard>
      ) : (
        <ul className="overflow-hidden rounded-[32px] border border-[#1E3148]/12 bg-white shadow-clay-sm">
          {visible.map((contact) => (
            <ContactRow
              key={contact.id}
              contact={contact}
              selected={contact.id === selectedId}
              assigneeName={
                members.find((m) => m.id === (contact.assignedTo ?? contact.createdBy))
                  ?.fullName ?? null
              }
              last={latest[contact.id] ?? null}
              bien={bienForContact(contact, biens)}
              leadAddress={contact.leadId ? leadAddresses[contact.leadId] ?? null : null}
              incomplete={isIncompleteContact(contact)}
              duplicateOf={partenaires.get(contact.id) ?? null}
              todayKey={todayKey}
              biens={biens}
              members={members}
              currentUserId={currentUserId}
              onOpen={() => setSelectedId((id) => (id === contact.id ? null : contact.id))}
              onComplete={() => setSelectedId(contact.id)}
              onMerge={() => openMerge(contact)}
              onRelance={(date) => void patchRelance(contact, date)}
              onEdit={() => {
                setEditing(contact);
                setFormOpen(true);
              }}
              onDelete={() => setPendingDelete(contact)}
              onAssigned={upsert}
            />
          ))}
        </ul>
      )}

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
          onOpenExisting={(c) => {
            upsert(c);
            setSelectedId(c.id);
            setFormOpen(false);
          }}
        />
      ) : null}

      {mergePair ? (
        <MergeContactsDialog
          keep={mergePair.keep}
          absorb={mergePair.absorb}
          members={members}
          onClose={() => setMergePair(null)}
          onMerged={onMerged}
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
