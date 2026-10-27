'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  Download,
  GripVertical,
  Home,
  Phone,
  Search,
  SlidersHorizontal,
  Upload,
  Users,
} from 'lucide-react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Bien } from '@/types/bien';
import { bienIsActive } from '@/types/bien';
import type { Contact, ContactType } from '@/types/contact';
import { aLeRole, CONTACT_TYPE_LABELS, rolesDuContact } from '@/types/contact';
import {
  civilToday,
  duplicatePartnerMap,
  isIncompleteContact,
  isRelanceDue,
  isRelanceFuture,
} from '@/lib/contacts/duplicates';
import {
  adresseRattachee,
  contactInitials,
  couleurLettre,
  formatContactMeta,
  formatLastInteraction,
  type LatestInteraction,
} from '@/lib/contacts/display';
import { fractionalPosition, positionNeighbors } from '@/lib/pipeline/position';
import { notifyError, notifySuccess } from '@/lib/notify';
import { exportContactsCsv } from '@/lib/import/export-contacts';
import { formatPhoneDisplay, formatPhoneWithConsent, normalizePhone, telHref } from '@/lib/import/normalize';
import DatePickerField from '@/components/ui/DatePickerField';
import { formatDatePickerLabel } from '@/lib/ui/date-picker';
import ConfirmModal from '@/components/ui/ConfirmModal';
import ImportContacts from '@/components/dashboard/import/ImportContacts';
import PageHeader from '@/components/dashboard/workspace/PageHeader';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import WorkspaceCard from '@/components/dashboard/workspace/WorkspaceCard';
import ContactDetailPanel from './ContactDetailPanel';
import ContactFormDialog from './ContactFormDialog';
import { CocheConsentementTel } from './ConsentementRappelField';
import DoublonsDialog, { type PaireDoublon } from './DoublonsDialog';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import ProfileAvatar from '@/components/dashboard/ProfileAvatar';
import { portraitDepuisMembre } from '@/lib/notes/auteur';
import PanneauAlerte from '@/components/ui/PanneauAlerte';
import Pastilles from '@/components/ui/Pastilles';

const SLATE = '#1A2A56';
const SELECTED = '#F1F2F4';

type EtatFilter = 'tous' | 'relance' | 'incompletes' | 'doublons';
type PorteeContacts = 'moi' | 'agence';

const ETATS_FILTRE: readonly { id: EtatFilter; label: string }[] = [
  { id: 'relance', label: 'À relancer' },
  { id: 'incompletes', label: 'Incomplètes' },
  { id: 'doublons', label: 'Doublons' },
];

const TYPES_FILTRE: readonly { id: ContactType; label: string }[] = [
  { id: 'vendeur', label: CONTACT_TYPE_LABELS.vendeur },
  { id: 'acquereur', label: CONTACT_TYPE_LABELS.acquereur },
];

function pastilleFiltre(actif: boolean) {
  return `rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-300 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56] ${
    actif ? 'bg-[#1A2A56] text-white' : 'bg-black/[0.04] text-text-strong hover:bg-black/[0.07]'
  }`;
}

function ChoixFiltre({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-medium text-text-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(value === opt.id ? 'tous' : opt.id)}
            className={pastilleFiltre(value === opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const CLE_ECARTES = 'priimo:doublons-ecartes';

function cleDePaire(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function lireEcartes(): Set<string> {
  try {
    const brut = window.localStorage.getItem(CLE_ECARTES);
    const liste: unknown = brut ? JSON.parse(brut) : [];
    return new Set(Array.isArray(liste) ? liste.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

const PORTEES_CONTACTS: readonly { id: PorteeContacts; label: string }[] = [
  { id: 'moi', label: 'Mes contacts' },
  { id: 'agence', label: 'Les contacts de toute l’agence' },
];

function contactAMoi(contact: Contact, userId: string): boolean {
  return (contact.assignedTo ?? contact.createdBy) === userId;
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
  marquePrivee = false,
  rangeable = false,
  dragHandleProps,
  sortableRef,
  sortableStyle,
  dragging = false,
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
  /** Fiche privée d'un collègue, visible parce que la direction voit toute l'agence. */
  marquePrivee?: boolean;
  /** Poignée de glisser-déposer visible (liste non filtrée). */
  rangeable?: boolean;
  dragHandleProps?: Record<string, unknown>;
  sortableRef?: (node: HTMLElement | null) => void;
  sortableStyle?: CSSProperties;
  dragging?: boolean;
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
  const rattache = adresseRattachee({
    bienAddress: bien?.address ?? null,
    leadAddress,
    contactAddress: contact.address,
    bienBanId: bien?.banId ?? null,
    contactBanId: contact.banId,
  });
  const assignee = members.find((m) => m.id === (contact.assignedTo ?? contact.createdBy));
  const assigneePortrait = assignee ? portraitDepuisMembre(assignee) : null;
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
      ref={sortableRef}
      className={`overflow-hidden border-b border-[#1A2A56]/12 transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] first:rounded-t-[32px] last:rounded-b-[32px] last:border-b-0 motion-reduce:transition-none ${
        dragging ? 'relative z-10 opacity-90 shadow-clay' : ''
      }`}
      style={{
        background: selected ? SELECTED : '#FFFFFF',
        borderBottomWidth: 0.5,
        ...sortableStyle,
      }}
    >
      <div
        className="flex min-h-[76px] cursor-pointer items-center gap-2 px-3 py-3 transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[#F1F2F4] motion-reduce:transition-none sm:gap-3 sm:px-5"
        style={selected ? { background: SELECTED } : undefined}
        onClick={onOpen}
      >
        {rangeable ? (
          <button
            type="button"
            className="flex size-8 shrink-0 cursor-grab items-center justify-center self-center rounded-full text-text-subtle hover:bg-black/[0.04] hover:text-text-muted active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label={`Déplacer ${contact.fullName}`}
            title="Glisser pour ranger"
            onClick={(e) => e.stopPropagation()}
            {...dragHandleProps}
          >
            <GripVertical size={16} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
        <span className="flex size-10 flex-shrink-0 items-center justify-center rounded-full bg-[#F3F4F6] text-[13px] font-semibold">
          {[...contactInitials(contact)].map((lettre, index) => (
            <span key={`${lettre}-${index}`} style={{ color: couleurLettre(lettre) }}>
              {lettre}
            </span>
          ))}
        </span>

        {/* Téléphone : l'identité prend toute la ligne, le suivi passe dessous. */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
          <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span
                className="min-w-0 max-w-full truncate font-semibold text-text-strong"
                style={{ fontSize: 15, letterSpacing: '-0.01em' }}
              >
                {contact.fullName}
              </span>
              {marquePrivee ? (
                <span className="inline-flex flex-shrink-0 items-center rounded-full bg-[#EFEBE3] px-2 py-0.5 text-[11px] font-medium text-[#1A2A56]">
                  Privée
                </span>
              ) : null}
              {contact.visibilite === 'agence' ? (
                <span
                  role="img"
                  aria-label="Fiche partagée avec l’agence"
                  title="Fiche partagée avec l’agence"
                  className="flex-shrink-0 text-text-subtle"
                >
                  <Users size={14} strokeWidth={2} aria-hidden />
                </span>
              ) : null}
              {rattache ? (
                rattache.href ? (
                  <Link
                    href={rattache.href}
                    title={rattache.adresse}
                    aria-label={`Maison, ${rattache.adresse}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex shrink-0 items-center gap-1 text-[13px] text-text-strong underline decoration-black/20 underline-offset-2 hover:decoration-black/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <Home size={14} strokeWidth={2} aria-hidden />
                    Maison
                  </Link>
                ) : (
                  <span
                    title={rattache.adresse}
                    className="inline-flex shrink-0 items-center gap-1 text-[13px] text-text-strong"
                  >
                    <Home size={14} strokeWidth={2} aria-hidden />
                    Maison
                  </span>
                )
              ) : null}
              {/* Une pastille par casquette : vendeuse et acquéreuse se lisent d'un coup d'œil. */}
              {rolesDuContact(contact).map((role) => (
                <span
                  key={role}
                  className="inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{ background: '#D5D8E4', color: SLATE }}
                >
                  {CONTACT_TYPE_LABELS[role]}
                </span>
              ))}
              {duplicateOf ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMerge();
                  }}
                  className="inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{ background: '#EFEBE3', color: '#1A2A56' }}
                >
                  Doublon possible
                </button>
              ) : null}
            </div>
            <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-text-muted">
              {assigneePortrait ? (
                <ProfileAvatar
                  firstName={assigneePortrait.firstName}
                  lastName={assigneePortrait.lastName}
                  avatarUrl={assigneePortrait.avatarUrl}
                  size={16}
                  className="shrink-0"
                />
              ) : null}
              <span className="min-w-0 truncate">{meta || '—'}</span>
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 sm:shrink-0 sm:flex-col sm:items-end">
            <p className="text-[12px] leading-none text-text-muted">{formatLastInteraction(last)}</p>
            <div className="flex items-center gap-2">
              {callableNow && contact.phone ? (
                contact.numeroCommuniqueParLaPersonne ? (
                  <a
                    href={telHref(contact.phone)}
                    className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium tabular-nums hover:bg-white/80 max-sm:bg-[#D5D8E4]/60"
                    style={{ color: SLATE }}
                    aria-label={`Appeler ${contact.fullName}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Phone size={12} strokeWidth={2.2} aria-hidden />
                    {/* Sur le téléphone, le bouton suffit : le numéro reste dans la fiche. */}
                    <span className="max-sm:sr-only">{formatPhoneDisplay(contact.phone)}</span>
                    <span className="sm:hidden">Appeler</span>
                    <CocheConsentementTel size={14} />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onComplete();
                    }}
                    title="Cochez le consentement au rappel dans la fiche pour afficher le numéro complet"
                    className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium tabular-nums text-text-muted hover:bg-white/80 max-sm:bg-[#D5D8E4]/60"
                  >
                    <Phone size={12} strokeWidth={2.2} aria-hidden />
                    <span>{formatPhoneWithConsent(contact.phone, false)}</span>
                  </button>
                )
              ) : incomplete ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onComplete();
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold"
                  style={{ background: '#D5D8E4', color: SLATE }}
                >
                  <PanneauAlerte size={13} label={null} />
                  À compléter
                </button>
              ) : null}
              <DatePickerField
                id={`relance-${contact.id}`}
                variant="compact"
                value={contact.recontacterLe}
                onChange={onRelance}
                stopPropagation
                placeholder="Planifier RDV"
                aria-label={
                  contact.recontacterLe
                    ? `RDV le ${formatDatePickerLabel(contact.recontacterLe, true)} pour ${contact.fullName}`
                    : `Planifier un RDV pour ${contact.fullName}`
                }
              />
            </div>
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
          className="flex size-8 flex-shrink-0 items-center justify-center self-center rounded-full text-text-subtle hover:bg-black/[0.04] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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

function SortableContactRow({
  rangeable,
  ...props
}: {
  rangeable: boolean;
} & Omit<
  Parameters<typeof ContactRow>[0],
  'rangeable' | 'dragHandleProps' | 'sortableRef' | 'sortableStyle' | 'dragging'
>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.contact.id,
    disabled: !rangeable,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <ContactRow
      {...props}
      rangeable={rangeable}
      dragHandleProps={rangeable ? { ...attributes, ...listeners } : undefined}
      sortableRef={setNodeRef}
      sortableStyle={style}
      dragging={isDragging}
    />
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
  retourGoogle = null,
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
  retourGoogle?: 'google' | 'google-refuse' | 'google-erreur' | null;
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

  const [portee, setPortee] = useState<PorteeContacts>('moi');
  const [typeFilter, setTypeFilter] = useState<ContactType | 'tous'>('tous');
  const [etatFilter, setEtatFilter] = useState<EtatFilter>('tous');
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const filtresRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (filtresOuverts) {
        setFiltresOuverts(false);
        return;
      }
      setSelectedId(null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [filtresOuverts]);

  useEffect(() => {
    if (!filtresOuverts) return;
    function onPointerDown(e: PointerEvent) {
      const cible = e.target;
      if (!(cible instanceof Node)) return;
      if (filtresRef.current?.contains(cible)) return;
      setFiltresOuverts(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [filtresOuverts]);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedContactId);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(retourGoogle !== null);
  const [editing, setEditing] = useState<Contact | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<Contact | null>(null);
  const [revue, setRevue] = useState<readonly PaireDoublon[] | null>(null);
  const [ecartes, setEcartes] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setEcartes(lireEcartes());
  }, []);

  const partenairesBruts = useMemo(() => duplicatePartnerMap(contacts), [contacts]);

  // Une paire écartée n'est plus signalée nulle part.
  const partenaires = useMemo(() => {
    const map = new Map<string, string>();
    for (const [id, autre] of partenairesBruts) {
      if (!ecartes.has(cleDePaire(id, autre))) map.set(id, autre);
    }
    return map;
  }, [partenairesBruts, ecartes]);

  const paires = useMemo(() => {
    const vues = new Set<string>();
    const out: PaireDoublon[] = [];
    for (const [id, autre] of partenaires) {
      const cle = cleDePaire(id, autre);
      if (vues.has(cle)) continue;
      vues.add(cle);
      out.push([id, autre]);
    }
    return out;
  }, [partenaires]);

  function ecarter([a, b]: PaireDoublon) {
    setEcartes((prev) => {
      const next = new Set(prev);
      next.add(cleDePaire(a, b));
      try {
        window.localStorage.setItem(CLE_ECARTES, JSON.stringify([...next]));
      } catch {
        /* rien : l'écart tient pour cette session */
      }
      return next;
    });
  }

  const perimetre = useMemo(() => {
    if (!isDirector || portee === 'agence') return contacts;
    return contacts.filter((c) => contactAMoi(c, currentUserId));
  }, [contacts, isDirector, portee, currentUserId]);

  const comptesPortee = useMemo(
    () => ({
      moi: contacts.filter((c) => contactAMoi(c, currentUserId)).length,
      agence: contacts.length,
    }),
    [contacts, currentUserId],
  );

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    const filtered = perimetre.filter((c) => {
      if (typeFilter !== 'tous' && !aLeRole(c, typeFilter)) return false;
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
      const ap = a.position;
      const bp = b.position;
      if (ap != null && bp != null && ap !== bp) return ap - bp;
      if (ap != null && bp == null) return -1;
      if (ap == null && bp != null) return 1;
      const aDue = isRelanceDue(a.recontacterLe, todayKey);
      const bDue = isRelanceDue(b.recontacterLe, todayKey);
      if (aDue !== bDue) return aDue ? -1 : 1;
      const aT = latest[a.id]?.occurredAt ?? '';
      const bT = latest[b.id]?.occurredAt ?? '';
      if (aT !== bT) return aT > bT ? -1 : 1;
      return a.fullName.localeCompare(b.fullName, 'fr');
    });
  }, [
    perimetre,
    portee,
    query,
    typeFilter,
    listFilter,
    listFilterIds,
    etatFilter,
    todayKey,
    partenaires,
    latest,
  ]);

  /** Ranger librement seulement quand la liste n’est pas filtrée (comme Gmail). */
  const peutRanger =
    !query.trim() &&
    etatFilter === 'tous' &&
    typeFilter === 'tous' &&
    listFilter == null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function rangerContact(event: DragEndEvent) {
    if (!peutRanger) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = visible.map((c) => c.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

    const contactId = String(active.id);
    const ordered = arrayMove(visible, oldIndex, newIndex);
    const neighbors = positionNeighbors(
      ordered.map((c) => ({
        id: c.id,
        stagePosition: c.id === contactId ? null : (c.position ?? null),
      })),
      newIndex,
      contactId,
    );
    const position = fractionalPosition(neighbors.previous, neighbors.next);
    const previous = contacts;

    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, position } : c)),
    );

    try {
      const res = await fetch(`/api/dashboard/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? 'Déplacement impossible');
      }
      const data = (await res.json()) as { contact?: Contact };
      if (data.contact) {
        setContacts((prev) =>
          prev.map((c) => (c.id === contactId ? { ...c, ...data.contact, position } : c)),
        );
      }
    } catch (err) {
      setContacts(previous);
      notifyError(err instanceof Error ? err.message : 'Déplacement impossible');
    }
  }

  const filtresActifs = (etatFilter !== 'tous' ? 1 : 0) + (typeFilter !== 'tous' ? 1 : 0);

  function toutAfficher() {
    setEtatFilter('tous');
    setTypeFilter('tous');
  }

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
    if (!otherId) return;
    // La paire cliquée passe en premier, les autres suivent.
    const cle = cleDePaire(contact.id, otherId);
    setRevue([
      [contact.id, otherId],
      ...paires.filter(([a, b]) => cleDePaire(a, b) !== cle),
    ]);
  }

  function onMerged(kept: Contact, absorbedId: string) {
    setContacts((list) => [kept, ...list.filter((c) => c.id !== kept.id && c.id !== absorbedId)]);
    if (selectedId === absorbedId) setSelectedId(kept.id);
  }

  function onMergeFailed(keptId: string, absorbed: Contact) {
    setContacts((list) => {
      if (list.some((c) => c.id === absorbed.id)) return list;
      const kept = list.find((c) => c.id === keptId);
      if (!kept) return [absorbed, ...list];
      return list.flatMap((c) => (c.id === keptId ? [c, absorbed] : [c]));
    });
  }

  return (
    <div className="w-full min-w-0 pb-4 pt-2 md:pb-8 md:pt-1 lg:pt-3">
      <PageHeader
        title="Contacts"
        titleAside={
          isDirector ? (
            <Pastilles
              role="tablist"
              label="Contacts affichés"
              value={portee}
              onChange={setPortee}
              options={PORTEES_CONTACTS.map((choix) => ({
                id: choix.id,
                label: (
                  <>
                    {choix.label}{' '}
                    <span className="tabular-nums">({comptesPortee[choix.id]})</span>
                  </>
                ),
              }))}
            />
          ) : null
        }
        subtitle={
          isDirector && perimetre.length > 0
            ? undefined
            : perimetre.length === 0
              ? isDirector && portee === 'agence'
                ? 'Les fiches de l’agence, y compris les privées'
                : 'Les personnes que vous rencontrez sur le terrain'
              : `${perimetre.length} ${perimetre.length > 1 ? 'personnes suivies' : 'personne suivie'}`
        }
        primaryAction={
          <WorkspaceButton
            type="button"
            variant="create"
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
          >
            <Users size={16} strokeWidth={2} aria-hidden />
            Nouveau contact
          </WorkspaceButton>
        }
        secondaryAction={
          <>
            <WorkspaceButton
              type="button"
              variant="secondary"
              onClick={() => setImportOpen(true)}
              className="max-sm:size-10 max-sm:px-0"
            >
              <Upload size={16} strokeWidth={2} aria-hidden />
              <span className="max-sm:sr-only">Importer</span>
            </WorkspaceButton>
            <WorkspaceButton
              type="button"
              variant="secondary"
              onClick={() => exportContactsCsv(perimetre)}
              className="max-sm:size-10 max-sm:px-0"
            >
              <Download size={16} strokeWidth={2} aria-hidden />
              <span className="max-sm:sr-only">Exporter</span>
            </WorkspaceButton>
          </>
        }
      />

      {paires.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[#1A2A56]/12 bg-white px-5 py-3.5 shadow-clay-sm">
          <p className="text-[14px] font-medium text-text-strong">
            {paires.length === 1 ? 'Il y a 1 doublon possible' : `Il y a ${paires.length} doublons possibles`}
          </p>
          <WorkspaceButton type="button" variant="secondary" onClick={() => setRevue(paires)}>
            Les passer en revue
          </WorkspaceButton>
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center gap-2.5 md:mb-8">
        <label className="relative w-full min-w-0 sm:w-auto">
          <Search
            size={17}
            strokeWidth={2.2}
            aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            id="contacts-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Un nom, un téléphone ou un email"
            aria-label="Chercher un nom, un téléphone ou un email"
            className="w-full rounded-full border border-black/[0.10] bg-white py-2.5 pl-11 pr-4 text-[14px] font-medium text-text-strong shadow-clay-sm outline-none placeholder:font-medium placeholder:text-text-muted hover:border-black/[0.14] focus:border-accent/50 focus:ring-2 focus:ring-accent/15 sm:w-[32rem]"
          />
        </label>
        <div ref={filtresRef} className="relative">
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={filtresOuverts}
            aria-controls="contacts-filtres"
            onClick={() => setFiltresOuverts((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2.5 text-[13.5px] font-medium outline-none transition-colors duration-300 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56] ${
              filtresActifs > 0 || filtresOuverts
                ? 'bg-[#1A2A56] text-white'
                : 'bg-black/[0.04] text-text-strong hover:bg-black/[0.07]'
            }`}
          >
            <SlidersHorizontal size={15} strokeWidth={2} aria-hidden />
            Filtres{filtresActifs > 0 ? ` (${filtresActifs})` : ''}
          </button>
          {filtresOuverts ? (
            <div
              id="contacts-filtres"
              role="dialog"
              aria-label="Filtres des contacts"
              className="absolute left-0 top-[calc(100%+8px)] z-20 w-[min(calc(100vw-2rem),18rem)] rounded-[24px] border border-black/[0.06] bg-white p-4 shadow-clay-sm sm:left-auto sm:right-0"
            >
              <div className="flex flex-col gap-4">
                <ChoixFiltre
                  label="À voir"
                  options={ETATS_FILTRE}
                  value={etatFilter}
                  onChange={(id) => setEtatFilter(id as EtatFilter)}
                />
                <ChoixFiltre
                  label="Type"
                  options={TYPES_FILTRE}
                  value={typeFilter}
                  onChange={(id) => setTypeFilter(id as ContactType | 'tous')}
                />
                {filtresActifs > 0 ? (
                  <button
                    type="button"
                    onClick={toutAfficher}
                    className="self-start text-[13px] font-medium text-text-muted hover:text-text-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56]"
                  >
                    Tout afficher
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {visible.length === 0 ? (
        <WorkspaceCard
          key={`${portee}:${etatFilter}:${typeFilter}`}
          className="carte-entree py-12 text-center"
        >
          <p className="text-pretty text-[14px] text-text-muted sm:text-[15px]">
            {perimetre.length === 0
              ? portee === 'agence' && isDirector
                ? 'Aucun contact dans l’agence pour l’instant.'
                : 'Aucun contact pour l’instant. Ajoutez la première personne rencontrée.'
              : 'Aucun contact ne correspond à cette recherche.'}
          </p>
        </WorkspaceCard>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => void rangerContact(event)}
        >
          <SortableContext
            items={visible.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul
              key={`${portee}:${etatFilter}:${typeFilter}`}
              className="carte-entree overflow-hidden rounded-[32px] border border-[#1A2A56]/12 bg-white shadow-clay-sm"
            >
              {visible.map((contact) => (
                <SortableContactRow
                  key={contact.id}
                  rangeable={peutRanger}
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
                  marquePrivee={
                    isDirector &&
                    portee === 'agence' &&
                    contact.visibilite !== 'agence' &&
                    !contactAMoi(contact, currentUserId)
                  }
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
          </SortableContext>
        </DndContext>
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

      {revue ? (
        <DoublonsDialog
          paires={revue}
          contacts={contacts}
          members={members}
          onClose={() => setRevue(null)}
          onEcarte={ecarter}
          onMerged={onMerged}
          onMergeFailed={onMergeFailed}
        />
      ) : null}

      <ImportContacts
        open={importOpen}
        onClose={() => setImportOpen(false)}
        contacts={contacts}
        retourGoogle={retourGoogle}
        onImported={(createdContacts, updatedContacts) => {
          setContacts((list) => {
            const byId = new Map(list.map((c) => [c.id, c]));
            for (const c of updatedContacts) byId.set(c.id, c);
            const createdIds = new Set(createdContacts.map((c) => c.id));
            const rest = [...byId.values()].filter((c) => !createdIds.has(c.id));
            return [...createdContacts, ...rest];
          });
        }}
        onAnnule={(supprimesIds, retablis) => {
          const retires = new Set(supprimesIds);
          const remis = new Map(retablis.map((c) => [c.id, c]));
          setContacts((list) => list.filter((c) => !retires.has(c.id)).map((c) => remis.get(c.id) ?? c));
          if (selectedId && retires.has(selectedId)) setSelectedId(null);
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
