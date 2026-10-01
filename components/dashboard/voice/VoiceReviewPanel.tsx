'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  Copy,
  ExternalLink,
  Lock,
  Pencil,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import type { NoteSourceInfo, VoiceNoteVisibilite } from '@/types/contact';
import { CONTACT_TYPE_LABELS, NOTE_SOURCE_LABELS } from '@/types/contact';
import type { NoteReviewPayload, PersonneProposal } from '@/lib/notes/build-review';
import type { ActionProposal } from '@/lib/notes/review-v2';
import { libelleMiseAJour, lignesRecherche, mailtoBrouillon } from '@/lib/notes/review-v2';
import { EMPTY_CONTACT_INPUT, type ContactInputFields } from '@/lib/contact-input';
import { formatPhoneOrNull, normalizeName, telHref } from '@/lib/import/normalize';
import type { ContactMatch } from '@/lib/notes/match';
import { matchMembersInTranscript } from '@/lib/notes/from-transcript';
import { dateParisIso } from '@/lib/notes/date-relative';
import { jourLisible, type CarteKind } from '@/lib/voice/cartes';
import { formatMinutes } from '@/lib/notes/temps-gagne';
import { notifyError, notifySuccess } from '@/lib/notify';
import Select from '@/components/ui/Select';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import { Field, TextArea } from '@/components/dashboard/workspace/Field';
import ProfileAvatar from '@/components/dashboard/ProfileAvatar';
import ContactFormFields, { type ContactFormGeo } from '@/components/dashboard/contacts/ContactFormFields';
import NoteEntitySearch, { type NoteLinkPick } from '@/components/dashboard/notes/NoteEntitySearch';
import NoteAncrage from '@/components/dashboard/notes/NoteAncrage';
import NoteMentionSensible from '@/components/dashboard/notes/NoteMentionSensible';
import IconeCarte from './live/IconeCarte';
import styles from './live/dictee.module.css';

const SOURCE_OPTIONS = [
  { value: '', label: 'Non précisé' },
  ...Object.entries(NOTE_SOURCE_LABELS).map(([value, label]) => ({ value, label })),
];

type ManualLink = NoteLinkPick & { key: string };
const LIENS_VIDES: readonly NoteLinkPick[] = [];

function toManualLinks(picks: readonly NoteLinkPick[]): ManualLink[] {
  return picks.map((p) => ({ ...p, key: `${p.entiteType}:${p.entiteId}` }));
}

function pickMatch(matches: readonly ContactMatch[]): ContactMatch | null {
  return matches.find((m) => m.confiance === 'certain') ?? matches[0] ?? null;
}

type ContactDraft = {
  fields: ContactInputFields;
  assignedTo: string | null;
  geo: ContactFormGeo;
};

function draftDepuisProposition(
  p: PersonneProposal,
  review: NoteReviewPayload,
  transcript: string,
  assignee: string | null,
): ContactDraft {
  return {
    fields: {
      ...EMPTY_CONTACT_INPUT,
      firstName: p.personne.firstName,
      lastName: p.personne.lastName,
      type: p.personne.type,
      phone: p.personne.phone,
      email: p.personne.email,
      address: review.immeuble?.adresseNormalisee ?? review.immeuble?.address ?? null,
      secteur: review.secteur,
      summary: transcript.trim() || null,
      recontacterLe: review.relance?.at ? review.relance.at.slice(0, 10) : null,
    },
    assignedTo: assignee,
    geo: { banId: review.immeuble?.banId ?? null, latitude: null, longitude: null },
  };
}

/** Les critères dictés remplissent la fiche d'un nouvel acquéreur, sans écraser ce que l'agent a saisi. */
function avecRecherche(fields: ContactInputFields, r: NoteReviewPayload['recherche']): ContactInputFields {
  if (!r) return fields;
  return {
    ...fields,
    type: fields.type === 'autre' ? 'acquereur' : fields.type,
    budgetMin: fields.budgetMin ?? r.budgetMin,
    budgetMax: fields.budgetMax ?? r.budgetMax,
    surfaceMin: fields.surfaceMin ?? r.surfaceMin,
    roomsMin: fields.roomsMin ?? r.roomsMin,
    postalCodes: fields.postalCodes.length ? fields.postalCodes : r.codesPostaux,
  };
}

function kindAction(a: ActionProposal): CarteKind {
  return a.type === 'rdv' ? 'rdv' : a.type === 'visite_faite' ? 'visite' : a.type === 'rappel' ? 'rappel' : 'tache';
}

/* -------------------------------------------------------------------------- */
/* Petits blocs                                                                */
/* -------------------------------------------------------------------------- */

function Groupe({ titre, children, compte }: { titre: string; children: React.ReactNode; compte?: number }) {
  return (
    <section className="flex flex-col gap-2">
      <h3
        className="flex items-center gap-2 font-semibold uppercase text-text-subtle"
        style={{ fontSize: 10.5, letterSpacing: '0.08em' }}
      >
        {titre}
        {compte ? (
          <span className="rounded-full bg-black/[0.05] px-1.5 py-px text-[10px] tabular-nums text-text-muted">
            {compte}
          </span>
        ) : null}
      </h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Case({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      className="mt-1.5 size-[18px] shrink-0 cursor-pointer rounded-md border-black/20"
      style={{ accentColor: 'var(--primary-500)' }}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

function Carte({
  children,
  inactive = false,
  className = '',
}: {
  children: React.ReactNode;
  inactive?: boolean;
  className?: string;
}) {
  return (
    <article
      className={`rounded-2xl border border-black/[0.07] bg-surface px-3.5 py-3 shadow-clay-sm transition-opacity ${
        inactive ? 'opacity-55' : ''
      } ${className}`}
    >
      {children}
    </article>
  );
}

function Puce({
  label,
  sous,
  onRemove,
  href,
  disabled,
  avatar,
}: {
  label: string;
  sous?: string | null;
  onRemove?: () => void;
  href?: string;
  disabled?: boolean;
  avatar?: { firstName: string; lastName: string; avatarUrl?: string | null };
}) {
  return (
    <li className="flex items-center gap-2.5 rounded-xl border border-black/[0.07] bg-surface py-1.5 pl-2.5 pr-1.5">
      {avatar ? (
        <ProfileAvatar firstName={avatar.firstName} lastName={avatar.lastName} avatarUrl={avatar.avatarUrl} size={26} />
      ) : null}
      <span className="min-w-0 flex-1">
        {href ? (
          <Link href={href} className="block truncate text-[13px] font-medium text-text-strong hover:text-primary-600">
            {label}
          </Link>
        ) : (
          <span className="block truncate text-[13px] font-medium text-text-strong">{label}</span>
        )}
        {sous ? <span className="block truncate text-[11.5px] text-text-muted">{sous}</span> : null}
      </span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Retirer ${label}`}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-text-subtle hover:bg-black/[0.04] hover:text-text-strong disabled:opacity-50"
        >
          <X size={15} strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Panneau                                                                     */
/* -------------------------------------------------------------------------- */

type Bilan = {
  lignes: string[];
  minutes: number;
};

export default function VoiceReviewPanel({
  review,
  transcript,
  onTranscript,
  onReviewChange,
  members,
  currentUserId,
  suggestedAssigneeId,
  onContinue,
  onDone,
  onDismiss,
  onQuestion,
  typed = false,
  initialManualLinks = LIENS_VIDES,
  extracting = false,
  parcelleId = null,
  adresse = null,
}: {
  review: NoteReviewPayload;
  transcript: string;
  onTranscript: (v: string) => void;
  onReviewChange: (review: NoteReviewPayload) => void;
  members: readonly AssigneeOption[];
  currentUserId?: string;
  suggestedAssigneeId: string | null;
  onContinue?: () => void;
  onDone: (contactId?: string | null) => void;
  onDismiss: () => void;
  /** La dictée était une question : on la passe à Mon assistant. */
  onQuestion?: (question: string) => void;
  typed?: boolean;
  initialManualLinks?: readonly NoteLinkPick[];
  extracting?: boolean;
  parcelleId?: string | null;
  adresse?: string | null;
}) {
  const [visibilite, setVisibilite] = useState<VoiceNoteVisibilite>(review.visibilite);
  const [sourceInfo, setSourceInfo] = useState<NoteSourceInfo | ''>(review.sourceInfo ?? '');
  const [refreshing, setRefreshing] = useState(false);
  const [terminating, setTerminating] = useState(false);
  const [bilan, setBilan] = useState<Bilan | null>(null);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [manualLinks, setManualLinks] = useState<ManualLink[]>(() => toManualLinks(initialManualLinks));
  const [hiddenConseillers, setHiddenConseillers] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ContactDraft>>({});
  const [ouverts, setOuverts] = useState<string[]>([]);
  const [emailOuvert, setEmailOuvert] = useState(false);
  const [plusOuvert, setPlusOuvert] = useState(false);
  const [leadsRetires, setLeadsRetires] = useState<string[]>([]);
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const sourceChoisie = useRef(false);
  const lastExtracted = (review.transcript ?? '').trim();
  const dirty = transcript.trim() !== lastExtracted;
  const canRefresh = transcript.trim().length > 0 && (dirty || review.extractFailed);
  const locked = refreshing || terminating;

  useEffect(() => {
    setHiddenIds([]);
    setManualLinks(toManualLinks(initialManualLinks));
    setHiddenConseillers([]);
    setDrafts({});
    setOuverts([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review.voiceNoteId]);

  // Les prospects trouvés à l'adresse sont retenus d'office : c'est là que l'agent se tient.
  const leadsRetenus = review.leads.map((l) => l.id).filter((id) => !leadsRetires.includes(id));

  useEffect(() => {
    if (sourceChoisie.current) return;
    setSourceInfo(review.sourceInfo ?? '');
  }, [review.sourceInfo]);

  // Une note analysée avant les actions multiples porte parfois une relance :
  // elle devient une action comme les autres, et donc une carte sur l'accueil.
  const actions = useMemo<ActionProposal[]>(() => {
    if (review.actions.length > 0 || !review.relance) return review.actions;
    return [
      {
        id: 'a-relance',
        type: 'rappel',
        intitule: review.relance.libelle,
        date: dateParisIso(new Date(review.relance.at)),
        dateDeduite: false,
        heure: null,
        personne: null,
        personneRef: review.personnes[0]?.id ?? null,
        lieu: null,
        rdvType: null,
        interet: null,
        accepted: true,
      },
    ];
  }, [review.actions, review.relance, review.personnes]);

  const conseillers = useMemo(
    () => matchMembersInTranscript(transcript, members).filter((m) => !hiddenConseillers.includes(m.memberId)),
    [transcript, members, hiddenConseillers],
  );
  const conseillerNameKeys = useMemo(
    () => new Set(conseillers.map((m) => normalizeName(m.label))),
    [conseillers],
  );

  function isConseillerPersonne(p: PersonneProposal): boolean {
    return conseillerNameKeys.has(normalizeName(`${p.personne.firstName} ${p.personne.lastName}`.trim()));
  }

  function pickedAssignee(): string | null {
    return conseillers.find((c) => c.memberId !== currentUserId)?.memberId ?? conseillers[0]?.memberId ?? null;
  }

  const personnes = review.personnes.filter(
    (p) =>
      !hiddenIds.includes(p.id) &&
      !isConseillerPersonne(p) &&
      Boolean(p.matches.length || p.personne.firstName.trim() || p.personne.lastName.trim() || p.personne.phone),
  );

  function draftPour(p: PersonneProposal): ContactDraft {
    return drafts[p.id] ?? draftDepuisProposition(p, review, transcript, suggestedAssigneeId ?? currentUserId ?? null);
  }

  function setAction(id: string, patch: Partial<ActionProposal>) {
    onReviewChange({
      ...review,
      actions: actions.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    });
  }

  async function patchNote(body: Record<string, unknown>) {
    const res = await fetch(`/api/dashboard/voice-notes/${review.voiceNoteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(data.error ?? 'patch');
  }

  async function togglePrivee(next: boolean) {
    const value: VoiceNoteVisibilite = next ? 'privee' : 'agence';
    setVisibilite(value);
    try {
      await patchNote({ visibilite: value });
    } catch {
      setVisibilite(visibilite);
      notifyError("La visibilité n'a pas pu être enregistrée");
    }
  }

  function addManualLink(pick: NoteLinkPick) {
    const key = `${pick.entiteType}:${pick.entiteId}`;
    setManualLinks((prev) => {
      const base = pick.entiteType === 'immeuble' ? prev.filter((l) => l.entiteType !== 'immeuble') : prev;
      return base.some((l) => l.key === key) ? base : [...base, { ...pick, key }];
    });
  }

  async function rafraichir() {
    if (!canRefresh || refreshing) return;
    setRefreshing(true);
    try {
      const res = await fetch(`/api/dashboard/voice-notes/${review.voiceNoteId}/rafraichir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });
      const data = (await res.json()) as NoteReviewPayload & { error?: string };
      if (!res.ok) throw new Error(data.error);
      onTranscript(data.transcript ?? transcript);
      onReviewChange(data);
      setDrafts({});
      if (data.sourceInfo && !sourceChoisie.current) setSourceInfo(data.sourceInfo);
    } catch {
      notifyError("La note n'a pas pu être relue");
    } finally {
      setRefreshing(false);
    }
  }

  /* ------------------------------------------------------------ Validation */

  async function creerContact(p: PersonneProposal): Promise<string> {
    const draft = draftsRef.current[p.id] ?? draftPour(p);
    const recherche = review.recherche?.accepted && review.recherche.personneRef === p.id ? review.recherche : null;
    const res = await fetch('/api/dashboard/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...avecRecherche(draft.fields, recherche),
        assignedTo: draft.assignedTo ?? pickedAssignee(),
        banId: draft.geo.banId,
        latitude: draft.geo.latitude,
        longitude: draft.geo.longitude,
        source: typed ? 'manuel' : 'vocal',
        voiceNoteId: review.voiceNoteId,
      }),
    });
    const data = (await res.json()) as { error?: string; contact?: { id: string }; matches?: { contact: { id: string } }[] };
    // Doublon détecté : la fiche existe déjà, la note s'y rattache.
    if (res.status === 409 && data.matches?.[0]?.contact?.id) return data.matches[0].contact.id;
    if (!res.ok || !data.contact?.id) throw new Error(data.error ?? 'contact');
    return data.contact.id;
  }

  function terminer() {
    if (locked) return;
    const snap = review;
    const texte = transcript.trim();
    const assigneeId = pickedAssignee();
    setTerminating(true);

    void (async () => {
      const contactParRef = new Map<string, string>();
      const liens: { entiteType: string; entiteId: string; confiance: string }[] = [];
      let contactsCrees = 0;
      let premierContact: string | null = null;
      let rechercheContact: string | null = null;

      try {
        for (const p of personnes) {
          const match = pickMatch(p.matches);
          const draft = draftsRef.current[p.id];
          const aUnNom = Boolean(
            (draft?.fields.firstName ?? p.personne.firstName).trim() ||
              (draft?.fields.lastName ?? p.personne.lastName).trim() ||
              (draft?.fields.phone ?? p.personne.phone),
          );
          if (match) {
            contactParRef.set(p.id, match.contactId);
            liens.push({ entiteType: 'contact', entiteId: match.contactId, confiance: match.confiance });
            if (snap.recherche?.personneRef === p.id) rechercheContact = match.contactId;
          } else if (aUnNom) {
            const id = await creerContact(p);
            contactParRef.set(p.id, id);
            contactsCrees += 1;
          }
          premierContact = premierContact ?? contactParRef.get(p.id) ?? null;
        }
      } catch (err) {
        notifyError(err instanceof Error && err.message !== 'contact' ? err.message : "Le contact n'a pas pu être créé");
        setTerminating(false);
        return;
      }

      for (const link of manualLinks) {
        liens.push({ entiteType: link.entiteType, entiteId: link.entiteId, confiance: 'certain' });
        if (link.entiteType === 'contact') premierContact = premierContact ?? link.entiteId;
      }
      for (const bien of snap.biens) {
        if (!hiddenIds.includes(`bien-${bien.id}`)) liens.push({ entiteType: 'bien', entiteId: bien.id, confiance: 'probable' });
      }
      for (const leadId of leadsRetenus) liens.push({ entiteType: 'lead', entiteId: leadId, confiance: 'certain' });
      if (snap.immeuble?.banId && snap.immeuble.confiance && !hiddenIds.includes('immeuble')) {
        liens.push({ entiteType: 'immeuble', entiteId: snap.immeuble.banId, confiance: snap.immeuble.confiance });
      }

      const bienUnique = snap.biens.length === 1 ? snap.biens[0]!.id : null;
      const payload = {
        transcript: texte,
        visibilite,
        sourceInfo: sourceInfo || null,
        assignedTo: assigneeId,
        contactsCrees,
        liens,
        actions: actions
          .filter((a) => a.accepted)
          .map((a) => ({
            type: a.type,
            intitule: a.intitule,
            date: a.date,
            heure: a.heure,
            lieu: a.lieu,
            rdvType: a.rdvType,
            interet: a.interet,
            contactId: (a.personneRef && contactParRef.get(a.personneRef)) || premierContact,
            bienId: bienUnique,
            assignedTo: a.type === 'rdv' ? currentUserId : assigneeId ?? currentUserId,
          })),
        misesAJour: snap.misesAJour
          .filter((m) => m.accepted)
          .map((m) => ({ bienId: m.bienId, champ: m.champ, valeur: m.apres })),
        recherche:
          snap.recherche?.accepted && rechercheContact
            ? {
                contactId: rechercheContact,
                budgetMin: snap.recherche.budgetMin,
                budgetMax: snap.recherche.budgetMax,
                surfaceMin: snap.recherche.surfaceMin,
                roomsMin: snap.recherche.roomsMin,
                codesPostaux: snap.recherche.codesPostaux,
              }
            : null,
        prospect: snap.prospect?.accepted
          ? { leadId: snap.prospect.leadId, stageId: snap.prospect.stageId, motif: snap.prospect.motif }
          : null,
      };

      try {
        const res = await fetch(`/api/dashboard/voice-notes/${snap.voiceNoteId}/valider`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as {
          error?: string;
          echecs?: string[];
          minutesEvitees?: number;
          bilan?: { promesses: number; rendezVous: number; visites: number; misesAJour: number; recherche: boolean; prospect: boolean };
        };
        if (!res.ok) throw new Error(data.error ?? 'valider');
        if (data.echecs?.length) notifyError(`Rangée, sauf : ${[...new Set(data.echecs)].join(', ')}`);

        // Recopie dans l'historique du contact quand un collègue reprend la main.
        if (assigneeId && premierContact && contactsCrees === 0 && texte) {
          void fetch(`/api/dashboard/contacts/${premierContact}/interactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body: texte, kind: typed ? 'note' : 'vocal', assignedTo: assigneeId }),
          }).catch(() => undefined);
        }

        const b = data.bilan;
        const lignes: string[] = [];
        if (contactsCrees) lignes.push(`${contactsCrees} contact${contactsCrees > 1 ? 's' : ''} créé${contactsCrees > 1 ? 's' : ''}`);
        const aFaire = (b?.promesses ?? 0) + (b?.rendezVous ?? 0);
        if (b?.promesses) lignes.push(`${b.promesses} rappel${b.promesses > 1 ? 's' : ''} sur votre accueil`);
        if (b?.rendezVous) lignes.push(`${b.rendezVous} rendez-vous planifié${b.rendezVous > 1 ? 's' : ''}`);
        if (b?.visites) lignes.push('Visite enregistrée');
        if (b?.misesAJour) lignes.push(`${b.misesAJour} fiche${b.misesAJour > 1 ? 's' : ''} mise${b.misesAJour > 1 ? 's' : ''} à jour`);
        if (b?.recherche) lignes.push('Recherche acquéreur enregistrée');
        if (b?.prospect) lignes.push('Prospect avancé dans le pipeline');
        if (lignes.length === 0) lignes.push(aFaire ? 'Note rangée' : 'Note rangée dans vos notes');
        setBilan({ lignes, minutes: data.minutesEvitees ?? 0 });
        notifySuccess(
          data.minutesEvitees
            ? `Note rangée · ≈ ${formatMinutes(data.minutesEvitees)} de saisie évitées`
            : 'Note rangée',
          { id: `voice-saved-${snap.voiceNoteId}` },
        );
        window.setTimeout(() => {
          onDismiss();
          onDone(premierContact);
        }, 1_900);
      } catch {
        notifyError("La note n'a pas pu être rangée. Réessayez.");
        setTerminating(false);
      }
    })();
  }

  /* ---------------------------------------------------------------- Rendu */

  if (bilan) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-12 text-center" role="status">
        <span className="flex size-16 items-center justify-center rounded-full bg-primary-50">
          <svg viewBox="0 0 24 24" className="size-8 text-primary-600" fill="none" aria-hidden>
            <path
              d="M5 12.5l4.2 4.2L19 7"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={styles.cocheTrace}
            />
          </svg>
        </span>
        <div>
          <p className="font-display text-[20px] font-semibold text-text-strong">C’est rangé.</p>
          {bilan.minutes >= 1 ? (
            <p className="mt-1 text-[13.5px] text-text-muted">
              ≈ {formatMinutes(bilan.minutes)} de saisie évitées
            </p>
          ) : null}
        </div>
        <ul className="flex flex-col gap-1.5">
          {bilan.lignes.map((l, i) => (
            <li
              key={l}
              className={`text-[14px] font-medium text-text-strong ${styles.carteEntree}`}
              style={{ animationDelay: `${160 + i * 90}ms` }}
            >
              {l}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const actionsRetenues = actions.filter((a) => a.accepted).length;
  const majRetenues = review.misesAJour.filter((m) => m.accepted).length + (review.prospect?.accepted ? 1 : 0);
  const resumePied = [
    personnes.length ? `${personnes.length} contact${personnes.length > 1 ? 's' : ''}` : null,
    actionsRetenues ? `${actionsRetenues} action${actionsRetenues > 1 ? 's' : ''}` : null,
    majRetenues ? `${majRetenues} mise${majRetenues > 1 ? 's' : ''} à jour` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const rien =
    !extracting &&
    personnes.length === 0 &&
    actions.length === 0 &&
    review.misesAJour.length === 0 &&
    !review.recherche &&
    !review.prospect &&
    !review.email;

  return (
    <>
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:overflow-hidden">
        {/* ---------------------------------------------------- Ce qui a été dit */}
        <section className="flex flex-col border-b border-black/[0.06] bg-bg-subtle px-5 py-5 sm:px-6 lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-7 lg:py-6">
          {review.titre ? (
            <div className="mb-4">
              <p className="font-display text-[18px] font-semibold leading-snug text-text-strong">{review.titre}</p>
              {review.resume ? <p className="mt-1 text-pretty text-[13.5px] text-text-muted">{review.resume}</p> : null}
            </div>
          ) : null}
          <label
            htmlFor="voice-transcript"
            className="mb-2 font-semibold uppercase text-text-subtle"
            style={{ fontSize: 10.5, letterSpacing: '0.08em' }}
          >
            {typed ? 'Votre note' : 'Ce que vous avez dit'}
          </label>
          <TextArea
            id="voice-transcript"
            value={transcript}
            onChange={(e) => onTranscript(e.target.value)}
            rows={7}
            placeholder={
              typed ? 'Corrigez le texte si besoin.' : "La transcription n'a rien donné. Écrivez ici ce que vous vouliez noter."
            }
            className="lg:min-h-[240px] lg:flex-1"
          />
          <NoteMentionSensible />
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            {canRefresh ? (
              <WorkspaceButton type="button" variant="secondary" onClick={() => void rafraichir()} disabled={locked}>
                <RefreshCw size={15} strokeWidth={2} aria-hidden className={refreshing ? 'animate-spin' : undefined} />
                {refreshing ? 'Relecture…' : 'Relire le texte corrigé'}
              </WorkspaceButton>
            ) : null}
            {onContinue ? (
              <button
                type="button"
                onClick={onContinue}
                disabled={locked}
                className="min-h-10 rounded-xl px-2 text-[13.5px] font-medium text-primary-600 transition-colors hover:bg-primary-50 disabled:opacity-50"
              >
                Compléter la dictée
              </button>
            ) : null}
          </div>
        </section>

        {/* ------------------------------------------------------------- À ranger */}
        <section className="flex flex-col gap-5 px-5 py-5 sm:px-6 lg:min-h-0 lg:overflow-y-auto lg:px-7 lg:py-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-[16px] font-semibold text-text-strong">Ce que Priimo va ranger</h2>
            {extracting || refreshing ? (
              <p aria-live="polite" className="flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-primary-600">
                <Sparkles size={13} strokeWidth={2} aria-hidden className="motion-safe:animate-pulse" />
                Lecture approfondie…
              </p>
            ) : null}
          </div>

          {review.intention === 'question' && onQuestion ? (
            <Carte className="border-primary-200 bg-primary-50">
              <div className="flex items-start gap-3">
                <IconeCarte kind="question" />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-text-strong">C’est une question ?</p>
                  <p className="mt-0.5 text-[12.5px] text-text-muted">Mon assistant cherche la réponse dans vos fiches.</p>
                </div>
                <WorkspaceButton type="button" onClick={() => onQuestion(transcript.trim())} disabled={locked}>
                  Demander
                </WorkspaceButton>
              </div>
            </Carte>
          ) : null}

          <NoteAncrage parcelleId={parcelleId} adresse={adresse} />

          {rien ? (
            <p className="text-pretty text-[13.5px] text-text-muted">
              Rien à ranger au-delà de la note elle-même. Elle reste dans vos notes, rattachez-la si besoin.
            </p>
          ) : null}

          {/* ---- Personnes */}
          {personnes.length > 0 ? (
            <Groupe titre="Personnes" compte={personnes.length}>
              {personnes.map((p) => {
                const match = pickMatch(p.matches);
                const draft = draftPour(p);
                const ouvert = ouverts.includes(p.id);
                const nom =
                  match?.label ||
                  [draft.fields.firstName, draft.fields.lastName].filter(Boolean).join(' ') ||
                  draft.fields.phone ||
                  'Contact';
                const [prenom, ...reste] = nom.split(/\s+/);
                const phone = formatPhoneOrNull(match?.phone ?? draft.fields.phone);
                const type = p.personne.type !== 'autre' ? CONTACT_TYPE_LABELS[p.personne.type] : null;
                const recherche = review.recherche && review.recherche.personneRef === p.id ? review.recherche : null;
                return (
                  <Carte key={p.id}>
                    <div className="flex items-start gap-3">
                      <ProfileAvatar firstName={prenom ?? ''} lastName={reste.join(' ') || prenom || ''} size={38} className="shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-text-strong">{nom}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-text-muted">
                          <span
                            className={`rounded-full px-1.5 py-px text-[11px] font-semibold ${
                              match ? 'bg-black/[0.05] text-text-muted' : 'bg-primary-50 text-primary-600'
                            }`}
                          >
                            {match ? 'Déjà dans vos contacts' : 'Nouveau contact'}
                          </span>
                          {type ? <span>{type}</span> : null}
                          {phone ? (
                            <a href={telHref(phone)} className="tabular-nums hover:text-primary-600">
                              {phone}
                            </a>
                          ) : null}
                        </p>
                      </div>
                      {!match ? (
                        <button
                          type="button"
                          onClick={() => setOuverts((o) => (o.includes(p.id) ? o.filter((x) => x !== p.id) : [...o, p.id]))}
                          aria-expanded={ouvert}
                          aria-label={ouvert ? 'Replier la fiche' : 'Compléter la fiche'}
                          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-text-subtle hover:bg-black/[0.04] hover:text-text-strong"
                        >
                          <Pencil size={15} strokeWidth={2} aria-hidden />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setHiddenIds((h) => [...h, p.id])}
                        disabled={locked}
                        aria-label={`Retirer ${nom}`}
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-text-subtle hover:bg-black/[0.04] hover:text-text-strong disabled:opacity-50"
                      >
                        <X size={15} strokeWidth={2} aria-hidden />
                      </button>
                    </div>

                    {recherche ? (
                      <div className="mt-3 rounded-xl bg-bg-base px-3 py-2.5">
                        <label className="flex cursor-pointer items-start gap-2.5">
                          <Case
                            checked={recherche.accepted}
                            onChange={(v) => onReviewChange({ ...review, recherche: { ...recherche, accepted: v } })}
                            label="Enregistrer la recherche"
                          />
                          <span className="min-w-0">
                            <span className="block text-[13px] font-semibold text-text-strong">Recherche</span>
                            <span className="block text-[12.5px] text-text-muted">{lignesRecherche(recherche).join(' · ')}</span>
                          </span>
                        </label>
                        {recherche.correspondances.length > 0 ? (
                          <ul className="mt-2 flex flex-col gap-1 pl-7">
                            {recherche.correspondances.map((b) => (
                              <li key={b.id}>
                                <Link
                                  href={`/dashboard/biens?fiche=${b.id}`}
                                  className="group inline-flex max-w-full items-center gap-1.5 text-[12.5px] font-medium text-primary-600 hover:underline"
                                >
                                  <span className="truncate">{b.label}</span>
                                  <span className="shrink-0 tabular-nums text-text-subtle">{b.score}%</span>
                                  <ExternalLink size={12} strokeWidth={2} aria-hidden className="shrink-0 opacity-60" />
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 pl-7 text-[12px] text-text-subtle">Aucun bien de l’agence ne correspond pour l’instant.</p>
                        )}
                      </div>
                    ) : null}

                    {!match && ouvert ? (
                      <div className="mt-4 border-t border-black/[0.06] pt-4">
                        <ContactFormFields
                          idPrefix={`voice-${p.id}`}
                          fields={draft.fields}
                          onFields={(fields) => setDrafts((prev) => ({ ...prev, [p.id]: { ...(prev[p.id] ?? draft), fields } }))}
                          assignedTo={draft.assignedTo}
                          onAssignedTo={(assignedTo) =>
                            setDrafts((prev) => ({ ...prev, [p.id]: { ...(prev[p.id] ?? draft), assignedTo } }))
                          }
                          geo={draft.geo}
                          onGeo={(geo) => setDrafts((prev) => ({ ...prev, [p.id]: { ...(prev[p.id] ?? draft), geo } }))}
                          members={members}
                          currentUserId={currentUserId}
                          disabled={locked}
                        />
                      </div>
                    ) : null}
                  </Carte>
                );
              })}
            </Groupe>
          ) : null}

          {/* Recherche sans personne identifiée */}
          {review.recherche && !personnes.some((p) => p.id === review.recherche?.personneRef) ? (
            <Carte inactive>
              <div className="flex items-start gap-3">
                <IconeCarte kind="recherche" />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-text-strong">Recherche acquéreur</p>
                  <p className="text-[12.5px] text-text-muted">{lignesRecherche(review.recherche).join(' · ')}</p>
                  <p className="mt-1 text-[12px] text-text-subtle">Nommez l’acquéreur pour l’enregistrer sur sa fiche.</p>
                </div>
              </div>
            </Carte>
          ) : null}

          {/* ---- À faire */}
          {actions.length > 0 ? (
            <Groupe titre="À faire" compte={actionsRetenues}>
              {actions.map((a) => (
                <Carte key={a.id} inactive={!a.accepted}>
                  <div className="flex items-start gap-3">
                    <Case checked={a.accepted} onChange={(v) => setAction(a.id, { accepted: v })} label={`Garder : ${a.intitule}`} />
                    <IconeCarte kind={kindAction(a)} size={30} />
                    <div className="min-w-0 flex-1">
                      <input
                        value={a.intitule}
                        onChange={(e) => setAction(a.id, { intitule: e.target.value })}
                        aria-label="Intitulé"
                        className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 -ml-1 text-[14px] font-semibold text-text-strong outline-none transition-colors hover:border-black/10 focus:border-primary-400 focus:bg-surface"
                      />
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-text-muted">
                        <input
                          type="date"
                          value={a.date}
                          onChange={(e) => e.target.value && setAction(a.id, { date: e.target.value, dateDeduite: false })}
                          aria-label="Date"
                          className="rounded-lg border border-black/10 bg-surface px-2 py-1 text-[12.5px] text-text-strong"
                        />
                        {a.type === 'rdv' || a.heure ? (
                          <input
                            type="time"
                            value={a.heure ?? ''}
                            onChange={(e) => setAction(a.id, { heure: e.target.value || null })}
                            aria-label="Heure"
                            className="rounded-lg border border-black/10 bg-surface px-2 py-1 text-[12.5px] text-text-strong"
                          />
                        ) : null}
                        <span className={a.dateDeduite ? 'font-medium text-warning' : ''}>
                          {a.dateDeduite ? 'Date à confirmer' : jourLisible(a.date)}
                        </span>
                        {a.type === 'rappel' || a.type === 'tache' ? (
                          <span className="rounded-full bg-primary-50 px-1.5 py-px text-[11px] font-semibold text-primary-600">
                            Sur votre accueil
                          </span>
                        ) : null}
                        {a.type === 'visite_faite' && review.biens.length !== 1 ? (
                          <span className="text-text-subtle">Reste dans la note (aucun bien identifié)</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Carte>
              ))}
            </Groupe>
          ) : null}

          {/* ---- Mises à jour */}
          {review.misesAJour.length > 0 || review.prospect ? (
            <Groupe titre="Mises à jour">
              {review.misesAJour.map((m) => {
                const l = libelleMiseAJour(m);
                return (
                  <Carte key={m.id} inactive={!m.accepted}>
                    <label className="flex cursor-pointer items-start gap-3">
                      <Case
                        checked={m.accepted}
                        onChange={(v) =>
                          onReviewChange({
                            ...review,
                            misesAJour: review.misesAJour.map((x) => (x.id === m.id ? { ...x, accepted: v } : x)),
                          })
                        }
                        label={`Appliquer : ${l.quoi}`}
                      />
                      <IconeCarte kind="mise_a_jour" size={30} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold text-text-strong">
                          {l.quoi} <span className="font-normal text-text-subtle line-through">{l.avant}</span>{' '}
                          <span aria-hidden>→</span> {l.apres}
                        </span>
                        <Link href={`/dashboard/biens?fiche=${m.bienId}`} className="block truncate text-[12.5px] text-text-muted hover:text-primary-600">
                          {m.bienLabel}
                        </Link>
                      </span>
                    </label>
                  </Carte>
                );
              })}
              {review.prospect ? (
                <Carte inactive={!review.prospect.accepted}>
                  <label className="flex cursor-pointer items-start gap-3">
                    <Case
                      checked={review.prospect.accepted}
                      onChange={(v) => onReviewChange({ ...review, prospect: { ...review.prospect!, accepted: v } })}
                      label="Faire avancer le prospect"
                    />
                    <IconeCarte kind="prospect" size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold text-text-strong">
                        Prospect{' '}
                        {review.prospect.etapeActuelle ? (
                          <span className="font-normal text-text-subtle">{review.prospect.etapeActuelle} → </span>
                        ) : (
                          '→ '
                        )}
                        {review.prospect.stageLibelle}
                      </span>
                      <Link
                        href={`/dashboard/prospection?lead=${review.prospect.leadId}`}
                        className="block truncate text-[12.5px] text-text-muted hover:text-primary-600"
                      >
                        {review.prospect.adresse}
                        {review.prospect.motif ? ` · ${review.prospect.motif}` : ''}
                      </Link>
                    </span>
                  </label>
                </Carte>
              ) : null}
            </Groupe>
          ) : null}

          {/* ---- E-mail */}
          {review.email ? (
            <Groupe titre="E-mail à envoyer">
              <Carte>
                <div className="flex items-start gap-3">
                  <IconeCarte kind="email" size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-text-strong">
                      {review.email.destinataire ? `À ${review.email.destinataire}` : 'Brouillon prêt'}
                      {review.email.email ? (
                        <span className="ml-1.5 font-normal text-text-muted">{review.email.email}</span>
                      ) : null}
                    </p>
                    <input
                      value={review.email.objet}
                      onChange={(e) => onReviewChange({ ...review, email: { ...review.email!, objet: e.target.value } })}
                      aria-label="Objet"
                      className="mt-1 w-full rounded-lg border border-black/10 bg-surface px-2 py-1.5 text-[13px] text-text-strong focus:border-primary-400 focus:outline-none"
                    />
                    {emailOuvert ? (
                      <textarea
                        value={review.email.corps}
                        onChange={(e) => onReviewChange({ ...review, email: { ...review.email!, corps: e.target.value } })}
                        aria-label="Message"
                        rows={7}
                        className="mt-2 w-full rounded-lg border border-black/10 bg-surface px-2 py-1.5 text-[13px] leading-relaxed text-text focus:border-primary-400 focus:outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEmailOuvert(true)}
                        className="mt-2 line-clamp-3 w-full whitespace-pre-line text-left text-[13px] leading-relaxed text-text-muted hover:text-text"
                      >
                        {review.email.corps}
                      </button>
                    )}
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <a
                        href={mailtoBrouillon(review.email)}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-primary-500 px-3 text-[13px] font-semibold text-white shadow-clay-primary hover:bg-primary-600"
                      >
                        Ouvrir dans ma messagerie
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard
                            ?.writeText(`${review.email!.objet}\n\n${review.email!.corps}`)
                            .then(() => notifySuccess('E-mail copié'))
                            .catch(() => notifyError('Copie impossible'));
                        }}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-black/10 px-3 text-[13px] font-medium text-text-strong hover:bg-black/[0.03]"
                      >
                        <Copy size={14} strokeWidth={2} aria-hidden />
                        Copier
                      </button>
                    </div>
                  </div>
                </div>
              </Carte>
            </Groupe>
          ) : null}

          {/* ---- Rattachements */}
          <Groupe titre="Rattachée à">
            <ul className="flex flex-col gap-1.5">
              {review.immeuble && !hiddenIds.includes('immeuble') ? (
                <Puce
                  label={review.immeuble.adresseNormalisee ?? review.immeuble.address}
                  sous={review.immeuble.banId ? 'Immeuble' : 'Adresse citée'}
                  onRemove={() => setHiddenIds((h) => [...h, 'immeuble'])}
                  disabled={locked}
                />
              ) : null}
              {review.biens
                .filter((b) => !hiddenIds.includes(`bien-${b.id}`))
                .map((b) => (
                  <Puce
                    key={b.id}
                    label={b.label}
                    sous="Bien de l’agence"
                    href={`/dashboard/biens?fiche=${b.id}`}
                    onRemove={() => setHiddenIds((h) => [...h, `bien-${b.id}`])}
                    disabled={locked}
                  />
                ))}
              {review.leads
                .filter((l) => leadsRetenus.includes(l.id))
                .map((l) => (
                  <Puce
                    key={l.id}
                    label={l.label}
                    sous="Prospect DPE à cette adresse"
                    href={`/dashboard/prospection?lead=${l.id}`}
                    onRemove={() => setLeadsRetires((r) => [...r, l.id])}
                    disabled={locked}
                  />
                ))}
              {manualLinks.map((link) => (
                <Puce
                  key={link.key}
                  label={link.label}
                  sous={link.subtitle ?? 'Contact'}
                  onRemove={() => setManualLinks((prev) => prev.filter((l) => l.key !== link.key))}
                  disabled={locked}
                />
              ))}
              {conseillers.map((c) => {
                const member = members.find((m) => m.id === c.memberId);
                const names = member?.fullName.trim().split(/\s+/) ?? [];
                return (
                  <Puce
                    key={`conseiller:${c.memberId}`}
                    label={c.label}
                    sous="Conseiller — la note lui est confiée"
                    avatar={{
                      firstName: member?.firstName?.trim() || names[0] || '',
                      lastName: member?.lastName?.trim() || names.slice(1).join(' ') || '',
                      avatarUrl: member?.avatarUrl,
                    }}
                    onRemove={() => setHiddenConseillers((prev) => [...prev, c.memberId])}
                    disabled={locked}
                  />
                );
              })}
            </ul>
            <NoteEntitySearch
              onPick={addManualLink}
              disabled={locked}
              excludeIds={
                new Set([
                  ...manualLinks.map((l) => l.key),
                  ...personnes.flatMap((p) => p.matches.map((m) => `contact:${m.contactId}`)),
                ])
              }
            />
          </Groupe>

          {/* ---- Options */}
          <div className="flex flex-col gap-3 border-t border-black/[0.06] pt-4">
            <label className="flex min-h-10 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="size-[18px] rounded-md border-black/20"
                style={{ accentColor: 'var(--primary-500)' }}
                checked={visibilite === 'privee'}
                onChange={(e) => void togglePrivee(e.target.checked)}
              />
              <Lock size={14} strokeWidth={2} aria-hidden className="text-text-subtle" />
              <span className="text-[13.5px] font-medium text-text-strong">Garder pour moi</span>
            </label>
            <button
              type="button"
              onClick={() => setPlusOuvert((v) => !v)}
              aria-expanded={plusOuvert}
              className="inline-flex w-fit items-center gap-1 text-[12.5px] font-medium text-text-muted hover:text-text-strong"
            >
              <ChevronDown size={14} strokeWidth={2} aria-hidden className={plusOuvert ? 'rotate-180' : ''} />
              Source de l’information
              {sourceInfo ? ` · ${NOTE_SOURCE_LABELS[sourceInfo]}` : ''}
            </button>
            {plusOuvert ? (
              <Field label="Qui a donné l’information" htmlFor="voice-source">
                <Select
                  id="voice-source"
                  value={sourceInfo}
                  onChange={(v) => {
                    sourceChoisie.current = true;
                    setSourceInfo((v || '') as NoteSourceInfo | '');
                  }}
                  options={SOURCE_OPTIONS}
                  aria-label="Source de l’information"
                />
              </Field>
            ) : null}
          </div>
        </section>
      </div>

      <footer className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-black/[0.06] px-5 py-3.5 sm:px-6 lg:px-7">
        <p className="min-w-0 truncate text-[12.5px] text-text-muted">{resumePied || 'La note seule'}</p>
        <WorkspaceButton type="button" onClick={terminer} disabled={locked || extracting}>
          {terminating ? 'Rangement…' : extracting ? 'Lecture…' : 'Tout ranger'}
        </WorkspaceButton>
      </footer>
    </>
  );
}
