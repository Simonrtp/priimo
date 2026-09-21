'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import type { NoteSourceInfo, VoiceNoteVisibilite } from '@/types/contact';
import { CONTACT_TYPE_LABELS, NOTE_SOURCE_LABELS } from '@/types/contact';
import type { NoteReviewPayload, PersonneProposal } from '@/lib/notes/build-review';
import { formatPhoneOrNull, normalizeName, telHref } from '@/lib/import/normalize';
import type { ContactMatch } from '@/lib/notes/match';
import { matchMembersInTranscript } from '@/lib/notes/from-transcript';
import { notifyError, notifySuccess } from '@/lib/notify';
import Select from '@/components/ui/Select';
import type { SelectedAddress } from '@/components/AddressAutocomplete';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import AssigneeSelect, { type AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import { Field, TextArea } from '@/components/dashboard/workspace/Field';
import ProfileAvatar from '@/components/dashboard/ProfileAvatar';
import NoteEntitySearch, {
  type NoteLinkPick,
} from '@/components/dashboard/notes/NoteEntitySearch';
import NoteAncrage from '@/components/dashboard/notes/NoteAncrage';
import NoteMentionSensible from '@/components/dashboard/notes/NoteMentionSensible';

const SOURCE_OPTIONS = [
  { value: '', label: 'Non précisé' },
  ...Object.entries(NOTE_SOURCE_LABELS).map(([value, label]) => ({ value, label })),
];

type ManualLink = NoteLinkPick & { key: string };

function toManualLinks(picks: readonly NoteLinkPick[]): ManualLink[] {
  return picks.map((p) => ({ ...p, key: `${p.entiteType}:${p.entiteId}` }));
}

function LinkChip({
  label,
  subtitle,
  onRemove,
  disabled = false,
  avatar,
}: {
  label: string;
  subtitle: string;
  onRemove: () => void;
  disabled?: boolean;
  avatar?: { firstName: string; lastName: string; avatarUrl?: string | null };
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-black/[0.08] px-3 py-2.5">
      <span className="flex min-w-0 items-center gap-3">
        {avatar ? (
          <ProfileAvatar
            firstName={avatar.firstName}
            lastName={avatar.lastName}
            avatarUrl={avatar.avatarUrl}
            size={32}
            className="shrink-0"
          />
        ) : null}
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] font-medium text-text-strong">{label}</span>
          <span className="block text-[12px] text-text-muted">{subtitle}</span>
        </span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Retirer ${label}`}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-black/[0.04] hover:text-text-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
      >
        <X size={16} strokeWidth={2} aria-hidden />
      </button>
    </li>
  );
}

function pickMatch(matches: readonly ContactMatch[]): ContactMatch | null {
  const certain = matches.find((m) => m.confiance === 'certain');
  if (certain) return certain;
  return matches[0] ?? null;
}

function formatPrix(n: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(n)} €`;
}

function ficheContact(
  p: PersonneProposal,
  match: ContactMatch | null,
  review: NoteReviewPayload,
) {
  const nom =
    match?.label ||
    [p.personne.firstName, p.personne.lastName].filter(Boolean).join(' ') ||
    'Contact';
  const phone = formatPhoneOrNull(match?.phone ?? p.personne.phone);
  const email = (match?.email ?? p.personne.email)?.trim() || null;
  const adresse = match?.address?.trim() || null;
  const type = p.personne.type !== 'autre' ? CONTACT_TYPE_LABELS[p.personne.type] : null;
  const faits = [
    review.secteur,
    review.prix != null ? formatPrix(review.prix) : null,
  ].filter((v): v is string => Boolean(v));
  return { nom, phone, email, adresse, type, faits, nouveau: !match };
}

function ContactFiche({
  fiche,
  onRemove,
  disabled = false,
}: {
  fiche: ReturnType<typeof ficheContact>;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const names = fiche.nom.trim().split(/\s+/);
  const firstName = names[0] ?? '';
  const lastName = names.slice(1).join(' ');

  return (
    <article className="rounded-clay border border-black/[0.08] bg-surface px-4 py-4 shadow-clay-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <ProfileAvatar
            firstName={firstName}
            lastName={lastName || firstName}
            size={44}
            className="shrink-0"
          />
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold text-text-strong">{fiche.nom}</p>
            <p className="mt-0.5 text-[12.5px] text-text-muted">
              {fiche.nouveau ? 'Nouveau contact' : 'Déjà dans l’agence'}
              {fiche.type ? ` · ${fiche.type}` : ''}
            </p>
            {fiche.phone || fiche.email || fiche.adresse ? (
              <ul className="mt-2.5 flex flex-col gap-1">
                {fiche.phone ? (
                  <li>
                    <a
                      href={telHref(fiche.phone)}
                      className="text-[13.5px] tabular-nums text-text-strong hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {fiche.phone}
                    </a>
                  </li>
                ) : null}
                {fiche.email ? (
                  <li className="truncate text-[13.5px] text-text">{fiche.email}</li>
                ) : null}
                {fiche.adresse ? (
                  <li className="text-pretty text-[13.5px] text-text">{fiche.adresse}</li>
                ) : null}
              </ul>
            ) : null}
            {fiche.faits.length > 0 ? (
              <p className="mt-2 text-[12.5px] text-text-subtle">{fiche.faits.join(' · ')}</p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Retirer ${fiche.nom}`}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-black/[0.04] hover:text-text-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
        >
          <X size={16} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </article>
  );
}

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
  typed = false,
  initialManualLinks = [],
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
  /** Note tapée : pas de « compléter la dictée ». */
  typed?: boolean;
  /** Rattachements déjà choisis à l’écriture de la note. */
  initialManualLinks?: readonly NoteLinkPick[];
  /** La note est encore en cours de lecture : les champs vont se remplir. */
  extracting?: boolean;
  /** Parcelle d'origine : déjà liée, à afficher, pas à redemander. */
  parcelleId?: string | null;
  adresse?: string | null;
}) {
  const [visibilite, setVisibilite] = useState<VoiceNoteVisibilite>(review.visibilite);
  const [sourceInfo, setSourceInfo] = useState<NoteSourceInfo | ''>(review.sourceInfo ?? '');
  const [relanceAssignee, setRelanceAssignee] = useState<string | null>(suggestedAssigneeId);
  const [promesseAssignee, setPromesseAssignee] = useState<string | null>(suggestedAssigneeId);
  const [refreshing, setRefreshing] = useState(false);
  const [terminating, setTerminating] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [deselectedIds, setDeselectedIds] = useState<string[]>([]);
  const [chosenMatch, setChosenMatch] = useState<Record<string, string>>({});
  const [manualLinks, setManualLinks] = useState<ManualLink[]>(() => toManualLinks(initialManualLinks));
  const [hiddenConseillers, setHiddenConseillers] = useState<string[]>([]);
  const sourceChoisie = useRef(false);
  const lastExtracted = (review.transcript ?? '').trim();
  const dirty = transcript.trim() !== lastExtracted;
  const canRefresh = transcript.trim().length > 0 && (dirty || review.extractFailed);
  const locked = refreshing || terminating;

  useEffect(() => {
    setHiddenIds([]);
    setDeselectedIds([]);
    setChosenMatch({});
    setManualLinks(toManualLinks(initialManualLinks));
    setHiddenConseillers([]);
  }, [review.voiceNoteId, initialManualLinks]);

  // La lecture de la note se termine après l'ouverture du panneau : on adopte
  // la source qu'elle propose, sauf si l'agent a déjà choisi la sienne.
  useEffect(() => {
    if (sourceChoisie.current) return;
    setSourceInfo(review.sourceInfo ?? '');
  }, [review.sourceInfo]);

  const conseillers = useMemo(
    () => matchMembersInTranscript(transcript, members).filter((m) => !hiddenConseillers.includes(m.memberId)),
    [transcript, members, hiddenConseillers],
  );
  const conseillerNameKeys = useMemo(
    () => new Set(conseillers.map((m) => normalizeName(m.label))),
    [conseillers],
  );

  function isConseillerPersonne(p: PersonneProposal): boolean {
    return conseillerNameKeys.has(
      normalizeName(`${p.personne.firstName} ${p.personne.lastName}`.trim()),
    );
  }

  function pickedAssignee(): string | null {
    return (
      conseillers.find((c) => c.memberId !== currentUserId)?.memberId ??
      conseillers[0]?.memberId ??
      null
    );
  }

  function visiblePersonnes(): PersonneProposal[] {
    return review.personnes.filter((p) => !hiddenIds.includes(p.id) && !isConseillerPersonne(p));
  }

  function selectedMatchFor(p: PersonneProposal): ContactMatch | null {
    if (deselectedIds.includes(p.id)) return null;
    const chosen = chosenMatch[p.id];
    if (chosen) return p.matches.find((m) => m.contactId === chosen) ?? null;
    return pickMatch(p.matches);
  }

  function patchAdresse(address: string, selected?: SelectedAddress | null) {
    const trimmed = (selected?.label ?? address).trim();
    onReviewChange({
      ...review,
      immeuble: trimmed
        ? {
            address: trimmed,
            adresseNormalisee: selected?.label ?? review.immeuble?.adresseNormalisee ?? trimmed,
            banId: selected?.id ?? review.immeuble?.banId ?? null,
            score: review.immeuble?.score ?? null,
            confiance: selected?.id ? 'certain' : review.immeuble?.confiance ?? null,
          }
        : null,
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

  function addManualLink(pick: NoteLinkPick) {
    const key = `${pick.entiteType}:${pick.entiteId}`;
    setManualLinks((prev) => {
      const base = pick.entiteType === 'immeuble' ? prev.filter((l) => l.entiteType !== 'immeuble') : prev;
      return base.some((l) => l.key === key) ? base : [...base, { ...pick, key }];
    });
    if (pick.entiteType === 'immeuble') {
      patchAdresse(pick.label, {
        label: pick.label,
        latitude: pick.latitude ?? 0,
        longitude: pick.longitude ?? 0,
        city: '',
        postcode: '',
        id: pick.entiteId,
      });
    }
  }

  function removeManualLink(key: string) {
    setManualLinks((prev) => prev.filter((l) => l.key !== key));
  }

  function dismissPersonne(id: string) {
    setHiddenIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  async function addLien(entiteType: string, entiteId: string, confiance: string) {
    const res = await fetch(`/api/dashboard/voice-notes/${review.voiceNoteId}/liens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entiteType, entiteId, confiance, creePar: 'agent' }),
    });
    if (!res.ok) throw new Error('lien');
  }

  async function togglePrivee(next: boolean) {
    const value: VoiceNoteVisibilite = next ? 'privee' : 'agence';
    setVisibilite(value);
    try {
      await patchNote({ visibilite: value });
    } catch (err) {
      setVisibilite(visibilite);
      notifyError(
        err instanceof Error && err.message && err.message !== 'patch'
          ? err.message
          : "La visibilité n'a pas pu être enregistrée",
      );
    }
  }

  async function onSource(v: string) {
    const value = (v || '') as NoteSourceInfo | '';
    sourceChoisie.current = true;
    setSourceInfo(value);
    try {
      await patchNote({ sourceInfo: value || null });
    } catch (err) {
      notifyError(
        err instanceof Error && err.message && err.message !== 'patch'
          ? err.message
          : "La source n'a pas pu être enregistrée",
      );
    }
  }

  async function createContact(
    p: PersonneProposal,
    fiche: NoteReviewPayload,
    summary: string,
    forceCreate = false,
  ): Promise<string> {
    const address = fiche.immeuble?.adresseNormalisee ?? fiche.immeuble?.address ?? null;
    const banId = fiche.immeuble?.banId ?? null;
    const res = await fetch('/api/dashboard/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: p.personne.firstName,
        lastName: p.personne.lastName,
        type: p.personne.type,
        phone: p.personne.phone,
        email: p.personne.email,
        address,
        banId,
        secteur: fiche.secteur,
        summary: summary.trim() || null,
        source: typed ? 'manuel' : 'vocal',
        voiceNoteId: fiche.voiceNoteId,
        forceCreate,
        assignedTo: pickedAssignee(),
      }),
    });
    const data = (await res.json()) as {
      error?: string;
      contact?: { id: string };
      matches?: { contact: { id: string } }[];
    };

    // Doublon détecté côté API : rattacher plutôt qu’afficher une erreur.
    if (res.status === 409) {
      const existingId = data.matches?.[0]?.contact?.id;
      if (existingId) {
        try {
          await addLien('contact', existingId, 'probable');
        } catch {
          // Le contact existe ; le lien pourra être repris à la réconciliation.
        }
        return existingId;
      }
    }

    if (!res.ok || !data.contact?.id) {
      throw new Error(data.error ?? 'contact');
    }
    return data.contact.id;
  }

  async function resolveContactId(
    p: PersonneProposal,
    fiche: NoteReviewPayload,
    summary: string,
  ): Promise<string | null> {
    const hasName = Boolean(p.personne.firstName.trim() || p.personne.lastName.trim());
    const match = selectedMatchFor(p);

    if (match) {
      try {
        await addLien('contact', match.contactId, match.confiance);
      } catch {
        // Le rattachement se fera à la réconciliation.
      }
      return match.contactId;
    }

    if (p.matches.length > 0) return null;

    if (hasName) return createContact(p, fiche, summary);
    return null;
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
      if (data.sourceInfo && !sourceChoisie.current) setSourceInfo(data.sourceInfo);
      notifySuccess('Propositions mises à jour');
    } catch {
      notifyError("Les propositions n'ont pas pu être mises à jour");
    } finally {
      setRefreshing(false);
    }
  }

  function terminer() {
    if (locked) return;
    const snap = review;
    const text = transcript.trim();
    const relanceTo = relanceAssignee;
    const promesseTo = promesseAssignee;
    const assigneeId = pickedAssignee();

    setTerminating(true);
    void (async () => {
      let contactId: string | null = null;
      let createdContact = false;
      try {
        for (const p of visiblePersonnes()) {
          const before = contactId;
          const resolved = await resolveContactId(p, snap, text);
          contactId = contactId ?? resolved;
          if (resolved && resolved !== before && !selectedMatchFor(p) && p.matches.length === 0) {
            createdContact = true;
          }
        }
        for (const link of manualLinks) {
          try {
            await addLien(link.entiteType, link.entiteId, 'certain');
            if (link.entiteType === 'contact' && !contactId) contactId = link.entiteId;
          } catch {
            // Le rattachement pourra être repris depuis la fiche note.
          }
        }
      } catch (err) {
        console.error('[voice] contact', err);
        notifyError(
          err instanceof Error && err.message && err.message !== 'contact'
            ? err.message
            : "Le contact n'a pas pu être créé",
        );
        setTerminating(false);
        return;
      }

      try {
        if (text && text !== (snap.transcript ?? '').trim()) {
          try {
            await patchNote({ transcript: text });
          } catch {
            // Non bloquant.
          }
        }
        if (snap.immeuble?.banId && snap.immeuble.confiance) {
          try {
            await addLien('immeuble', snap.immeuble.banId, snap.immeuble.confiance);
          } catch {
            // La note reste, l’immeuble pourra être rattaché plus tard.
          }
        }
        if (assigneeId) {
          try {
            await patchNote({ assignedTo: assigneeId });
          } catch {
            // L’accueil du conseiller pourra être repris à la main.
          }
          if (contactId && !createdContact && text) {
            try {
              await fetch(`/api/dashboard/contacts/${contactId}/interactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  body: text,
                  kind: typed ? 'note' : 'vocal',
                  assignedTo: assigneeId,
                }),
              });
            } catch {
              // La note reste assignée même si l’échange n’est pas recopié.
            }
          }
        }
        if (snap.relance) {
          try {
            await patchNote({
              relance: { at: snap.relance.at, assignedTo: relanceTo },
            });
          } catch {
            // La relance n’est pas bloquante.
          }
        }
        const metierPayload: Record<string, unknown> = { contactId };
        if (snap.promesse?.accepted) {
          metierPayload.promesse = {
            accepted: true,
            intitule: snap.promesse.intitule,
            echeance: snap.promesse.echeance,
            assignedTo: promesseTo,
          };
        }
        if (snap.rendezVous?.accepted) {
          metierPayload.rendezVous = { ...snap.rendezVous, accepted: true };
        }
        if (snap.visite?.accepted) {
          metierPayload.visite = { ...snap.visite, accepted: true };
        }
        if (snap.promesse?.accepted || snap.rendezVous?.accepted || snap.visite?.accepted) {
          try {
            const res = await fetch(`/api/dashboard/voice-notes/${snap.voiceNoteId}/metier`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(metierPayload),
            });
            if (!res.ok) throw new Error('metier');
          } catch {
            notifyError('Engagement ou rendez-vous non enregistré');
          }
        }
        const closeRes = await fetch(`/api/dashboard/voice-notes/${snap.voiceNoteId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            terminer: true,
            visibilite,
            sourceInfo: sourceInfo || null,
          }),
        });
        if (!closeRes.ok) {
          if (contactId) {
            notifySuccess('Contact enregistré. La note reste à finaliser depuis l’accueil.', {
              id: `voice-contact-${snap.voiceNoteId}`,
            });
            onDismiss();
            onDone(contactId);
            return;
          }
          notifyError("La note n'a pas pu être clôturée");
          setTerminating(false);
          return;
        }
        notifySuccess('Votre note a bien été enregistrée', {
          id: `voice-saved-${snap.voiceNoteId}`,
        });
        onDismiss();
        onDone(contactId);
      } catch (err) {
        console.error('[voice] terminer', err);
        notifyError("La note n'a pas pu être enregistrée");
        setTerminating(false);
      }
    })();
  }

  return (
    <>
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col overflow-y-auto border-b border-black/[0.06] bg-bg-subtle px-5 py-5 sm:px-6 lg:border-b-0 lg:border-r lg:px-8 lg:py-6">
          <h3
            className="mb-4 font-semibold uppercase text-text-subtle"
            style={{ fontSize: 11, letterSpacing: '0.08em' }}
          >
            {typed ? 'Votre note' : 'Ce que vous avez dit'}
          </h3>
          <label htmlFor="voice-transcript" className="sr-only">
            {typed ? 'Texte de la note' : 'Transcription de la dictée'}
          </label>
          <TextArea
            id="voice-transcript"
            value={transcript}
            onChange={(e) => onTranscript(e.target.value)}
            rows={8}
            placeholder={
              typed
                ? 'Corrigez le texte si besoin.'
                : "La transcription n'a rien donné. Écrivez ici ce que vous vouliez noter."
            }
            className="flex-1 lg:min-h-[280px]"
          />
          <NoteMentionSensible />
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <WorkspaceButton
              type="button"
              variant="secondary"
              onClick={() => void rafraichir()}
              disabled={locked || !canRefresh}
            >
              <RefreshCw size={15} strokeWidth={2} aria-hidden className={refreshing ? 'animate-spin' : undefined} />
              {refreshing ? 'Mise à jour…' : 'Mettre à jour'}
            </WorkspaceButton>
            {onContinue ? (
              <button
                type="button"
                onClick={onContinue}
                disabled={locked}
                className="min-h-[40px] text-[13.5px] font-medium text-text-muted transition-colors duration-fluid-subtle ease-in-out hover:text-text-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Compléter la dictée
              </button>
            ) : null}
          </div>
        </section>

        <section className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6 lg:px-8 lg:py-6">
          <div className="mb-5 flex items-baseline justify-between gap-3">
            <h3
              className="font-semibold uppercase text-text-subtle"
              style={{ fontSize: 11, letterSpacing: '0.08em' }}
            >
              Ce qui sera enregistré
            </h3>
            {/* Sans ce repère, l'agent croit le formulaire vide et ressaisit à
                la main ce que la lecture est en train de remplir. */}
            {extracting ? (
              <p
                aria-live="polite"
                className="flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-text-subtle"
              >
                <RefreshCw size={13} strokeWidth={2} aria-hidden className="animate-spin" />
                Lecture de la note…
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-5">
            <NoteAncrage parcelleId={parcelleId} adresse={adresse} />

            {visiblePersonnes()
              .filter((p) => p.matches.length > 0 || p.personne.firstName.trim() || p.personne.lastName.trim())
              .map((p) => (
                <ContactFiche
                  key={p.id}
                  fiche={ficheContact(p, selectedMatchFor(p), review)}
                  onRemove={() => dismissPersonne(p.id)}
                  disabled={locked}
                />
              ))}

            <label className="flex min-h-[40px] cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="size-4 rounded border-black/20 text-accent focus:ring-accent/30"
                style={{ accentColor: '#E8743C' }}
                checked={visibilite === 'privee'}
                onChange={(e) => void togglePrivee(e.target.checked)}
              />
              <span className="text-[13.5px] font-medium text-text-strong">Garder pour moi</span>
            </label>

            <Field label="Source de l’information" htmlFor="voice-source">
              <Select
                id="voice-source"
                value={sourceInfo}
                onChange={onSource}
                options={SOURCE_OPTIONS}
                aria-label="Source de l’information"
              />
            </Field>

            {manualLinks.length > 0 || conseillers.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {manualLinks.map((link) => (
                  <LinkChip
                    key={link.key}
                    label={link.label}
                    subtitle={link.subtitle ?? 'Contact'}
                    onRemove={() => removeManualLink(link.key)}
                    disabled={locked}
                  />
                ))}
                {conseillers.map((c) => {
                  const member = members.find((m) => m.id === c.memberId);
                  const names = member?.fullName.trim().split(/\s+/) ?? [];
                  const firstName = member?.firstName?.trim() || names[0] || '';
                  const lastName = member?.lastName?.trim() || names.slice(1).join(' ') || '';
                  return (
                    <LinkChip
                      key={`conseiller:${c.memberId}`}
                      label={c.label}
                      subtitle="Conseiller"
                      avatar={{
                        firstName,
                        lastName,
                        avatarUrl: member?.avatarUrl,
                      }}
                      onRemove={() =>
                        setHiddenConseillers((prev) =>
                          prev.includes(c.memberId) ? prev : [...prev, c.memberId],
                        )
                      }
                      disabled={locked}
                    />
                  );
                })}
              </ul>
            ) : null}

            <NoteEntitySearch
              onPick={addManualLink}
              disabled={locked}
              excludeIds={
                new Set([
                  ...manualLinks.map((l) => l.key),
                  ...visiblePersonnes().flatMap((p) =>
                    p.matches.map((m) => `contact:${m.contactId}`),
                  ),
                ])
              }
            />

            {review.relance ? (
              <article className="rounded-xl border border-black/[0.08] px-4 py-3.5">
                <p className="font-medium text-text-strong" style={{ fontSize: 14.5 }}>
                  {review.relance.libelle}
                </p>
                <p className="mt-1 text-[12.5px] text-text-subtle">
                  {new Intl.DateTimeFormat('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                  }).format(new Date(review.relance.at))}
                </p>
                {members.length > 1 ? (
                  <div className="mt-3">
                    <Field label="Assigner à" htmlFor="voice-relance-assignee">
                      <AssigneeSelect
                        id="voice-relance-assignee"
                        value={relanceAssignee}
                        members={members}
                        currentUserId={currentUserId}
                        includeUnassigned
                        unassignedLabel="Moi"
                        onChange={setRelanceAssignee}
                      />
                    </Field>
                  </div>
                ) : null}
              </article>
            ) : null}

            {review.promesse ? (
              <article className="rounded-xl border border-black/[0.08] px-4 py-3.5">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 rounded border-black/20"
                    style={{ accentColor: '#E8743C' }}
                    checked={review.promesse.accepted}
                    onChange={(e) =>
                      onReviewChange({
                        ...review,
                        promesse: { ...review.promesse!, accepted: e.target.checked },
                      })
                    }
                  />
                  <span>
                    <p className="font-medium text-text-strong" style={{ fontSize: 14.5 }}>
                      Promesse · {review.promesse.intitule}
                    </p>
                    <p className="mt-1 text-[12.5px] text-text-subtle">
                      {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(
                        new Date(`${review.promesse.echeance}T12:00:00`),
                      )}
                    </p>
                  </span>
                </label>
                {members.length > 1 ? (
                  <div className="mt-3">
                    <Field label="Assigner à" htmlFor="voice-promesse-assignee">
                      <AssigneeSelect
                        id="voice-promesse-assignee"
                        value={promesseAssignee}
                        members={members}
                        currentUserId={currentUserId}
                        includeUnassigned
                        unassignedLabel="Moi"
                        onChange={setPromesseAssignee}
                      />
                    </Field>
                  </div>
                ) : null}
              </article>
            ) : null}

            {review.rendezVous ? (
              <article className="rounded-xl border border-black/[0.08] px-4 py-3.5">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 rounded border-black/20"
                    style={{ accentColor: '#E8743C' }}
                    checked={review.rendezVous.accepted}
                    onChange={(e) =>
                      onReviewChange({
                        ...review,
                        rendezVous: { ...review.rendezVous!, accepted: e.target.checked },
                      })
                    }
                  />
                  <span>
                    <p className="font-medium text-text-strong" style={{ fontSize: 14.5 }}>
                      Rendez-vous · {review.rendezVous.type}
                    </p>
                    <p className="mt-1 text-[12.5px] text-text-subtle">
                      {new Intl.DateTimeFormat('fr-FR', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(review.rendezVous.debut))}
                      {review.rendezVous.lieu ? ` · ${review.rendezVous.lieu}` : ''}
                    </p>
                  </span>
                </label>
              </article>
            ) : null}

            {review.visite ? (
              <article className="rounded-xl border border-black/[0.08] px-4 py-3.5">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 rounded border-black/20"
                    style={{ accentColor: '#E8743C' }}
                    checked={review.visite.accepted}
                    onChange={(e) =>
                      onReviewChange({
                        ...review,
                        visite: { ...review.visite!, accepted: e.target.checked },
                      })
                    }
                  />
                  <span>
                    <p className="font-medium text-text-strong" style={{ fontSize: 14.5 }}>
                      Visite effectuée
                    </p>
                    {review.visite.retour ? (
                      <p className="mt-1 text-[13px] text-text-muted">{review.visite.retour}</p>
                    ) : null}
                  </span>
                </label>
              </article>
            ) : null}
          </div>
        </section>
      </div>

      <footer className="flex flex-shrink-0 items-center justify-end gap-3 border-t border-black/[0.06] px-5 py-4 sm:px-6 lg:px-8 lg:py-5">
        <WorkspaceButton type="button" onClick={terminer} disabled={locked}>
          {terminating ? 'Validation…' : 'Terminer'}
        </WorkspaceButton>
      </footer>
    </>
  );
}
