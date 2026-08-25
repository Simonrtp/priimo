'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { ContactType, NoteSourceInfo, VoiceNoteVisibilite } from '@/types/contact';
import { CONTACT_TYPE_LABELS, CONTACT_TYPE_ORDER, NOTE_SOURCE_LABELS } from '@/types/contact';
import type { NoteReviewPayload, PersonneProposal } from '@/lib/notes/build-review';
import type { ContactMatch } from '@/lib/notes/match';
import type { ExtractedPersonne } from '@/lib/notes/propositions';
import { notifyError, notifySuccess } from '@/lib/notify';
import Select from '@/components/ui/Select';
import AddressAutocomplete, { type SelectedAddress } from '@/components/AddressAutocomplete';
import ConfirmModal from '@/components/ui/ConfirmModal';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import AssigneeSelect, { type AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import { ADDRESS_FIELD_INPUT_CLASS, Field, TextArea, TextInput } from '@/components/dashboard/workspace/Field';

const SOURCE_OPTIONS = [
  { value: '', label: 'Non précisé' },
  ...Object.entries(NOTE_SOURCE_LABELS).map(([value, label]) => ({ value, label })),
];

const TYPE_OPTIONS = CONTACT_TYPE_ORDER.map((value) => ({
  value,
  label: CONTACT_TYPE_LABELS[value],
}));

const BLANK_PERSONNE: ExtractedPersonne = {
  firstName: '',
  lastName: '',
  phone: null,
  email: null,
  type: 'autre',
};

function personEditors(review: NoteReviewPayload): PersonneProposal[] {
  if (review.personnes.length > 0) return review.personnes;
  return [{ id: 'p-new', personne: BLANK_PERSONNE, matches: [] }];
}

function parsePositiveInt(raw: string, max: number): number | null {
  const n = Number(raw.replace(/[^\d]/g, ''));
  if (!Number.isFinite(n) || n <= 0 || n > max) return null;
  return Math.round(n);
}

function pickMatch(matches: readonly ContactMatch[]): ContactMatch | null {
  const certain = matches.find((m) => m.confiance === 'certain');
  if (certain) return certain;
  if (matches.length === 1) return matches[0];
  return null;
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
  onDiscard,
  typed = false,
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
  onDiscard: () => void;
  /** Note tapée : pas de « compléter la dictée ». */
  typed?: boolean;
}) {
  const [visibilite, setVisibilite] = useState<VoiceNoteVisibilite>(review.visibilite);
  const [sourceInfo, setSourceInfo] = useState<NoteSourceInfo | ''>(review.sourceInfo ?? '');
  const [relanceAssignee, setRelanceAssignee] = useState<string | null>(suggestedAssigneeId);
  const [promesseAssignee, setPromesseAssignee] = useState<string | null>(suggestedAssigneeId);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const lastExtracted = (review.transcript ?? '').trim();
  const dirty = transcript.trim() !== lastExtracted;
  const canRefresh = transcript.trim().length > 0 && (dirty || review.extractFailed);
  const locked = refreshing || deleting;

  function patchPersonnes(next: PersonneProposal[]) {
    onReviewChange({ ...review, personnes: next });
  }

  function patchPersonne(id: string, patch: Partial<ExtractedPersonne>) {
    const current = personEditors(review);
    patchPersonnes(
      current.map((p) => (p.id === id ? { ...p, personne: { ...p.personne, ...patch } } : p)),
    );
  }

  function patchFiche(patch: Partial<Pick<NoteReviewPayload, 'secteur' | 'prix' | 'rooms' | 'surface'>>) {
    onReviewChange({ ...review, ...patch });
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
    if (!res.ok) throw new Error('patch');
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
    } catch {
      setVisibilite(visibilite);
      notifyError("La visibilité n'a pas pu être enregistrée");
    }
  }

  async function onSource(v: string) {
    const value = (v || '') as NoteSourceInfo | '';
    setSourceInfo(value);
    try {
      await patchNote({ sourceInfo: value || null });
    } catch {
      notifyError("La source n'a pas pu être enregistrée");
    }
  }

  async function createContact(p: PersonneProposal, fiche: NoteReviewPayload, summary: string): Promise<string> {
    const address = fiche.immeuble?.adresseNormalisee ?? fiche.immeuble?.address ?? null;
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
        secteur: fiche.secteur,
        budgetMax: fiche.prix,
        roomsMin: fiche.rooms,
        surfaceMin: fiche.surface,
        summary: summary.trim() || null,
        source: typed ? 'manuel' : 'vocal',
        voiceNoteId: fiche.voiceNoteId,
      }),
    });
    const data = (await res.json()) as { error?: string; contact?: { id: string } };
    if (!res.ok || !data.contact?.id) throw new Error(data.error ?? 'contact');
    return data.contact.id;
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
      if (data.sourceInfo) setSourceInfo(data.sourceInfo);
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
    const text = transcript;
    const relanceTo = relanceAssignee;
    const promesseTo = promesseAssignee;
    onDismiss();
    void (async () => {
      try {
        let contactId: string | null = null;
        for (const p of personEditors(snap)) {
          const match = pickMatch(p.matches);
          if (match) {
            try {
              await addLien('contact', match.contactId, match.confiance);
            } catch {
              // Le rattachement se fera à la réconciliation.
            }
            contactId = contactId ?? match.contactId;
          } else if (p.personne.firstName || p.personne.lastName) {
            contactId = contactId ?? (await createContact(p, snap, text));
          }
        }
        if (snap.immeuble?.banId && snap.immeuble.confiance) {
          try {
            await addLien('immeuble', snap.immeuble.banId, snap.immeuble.confiance);
          } catch {
            // La note reste, l’immeuble pourra être rattaché plus tard.
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
        await fetch(`/api/dashboard/voice-notes/${snap.voiceNoteId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ terminer: true }),
        });
        notifySuccess('Votre note a bien été enregistrée', {
          id: `voice-saved-${snap.voiceNoteId}`,
        });
        onDone(contactId);
      } catch {
        notifyError("Le contact n'a pas pu être créé");
      }
    })();
  }

  async function supprimer() {
    if (locked) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/dashboard/voice-notes/${review.voiceNoteId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('delete');
      notifySuccess('Note supprimée');
      onDiscard();
    } catch {
      notifyError("La note n'a pas pu être supprimée");
      setDeleting(false);
    }
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
          <p className="mt-3 text-pretty text-text-muted" style={{ fontSize: 13, lineHeight: 1.45 }}>
            {typed
              ? 'Corrigez si besoin, puis mettez à jour les propositions.'
              : 'Corrigez votre phrase si besoin, puis mettez à jour.'}
          </p>
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
                className="min-h-[40px] text-[13.5px] font-medium text-text-muted transition-colors hover:text-text-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Compléter la dictée
              </button>
            ) : null}
          </div>
          {review.extractFailed ? (
            <p className="mt-3 text-pretty text-text-muted" style={{ fontSize: 13 }}>
              La mise en forme n’a rien donné. Corrigez le texte, puis réessayez.
            </p>
          ) : null}
        </section>

        <section className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6 lg:px-8 lg:py-6">
          <h3
            className="mb-5 font-semibold uppercase text-text-subtle"
            style={{ fontSize: 11, letterSpacing: '0.08em' }}
          >
            Ce qui sera enregistré
          </h3>

          <div className="flex flex-col gap-5">
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

            <p
              id="voice-review-hint"
              className="text-pretty text-text-muted"
              style={{ fontSize: 13, lineHeight: 1.45 }}
            >
              Pré-rempli d’après la dictée. Corrigez si l’oral a été mal compris.
            </p>

            {personEditors(review).map((p) => {
              const match = pickMatch(p.matches);
              const displayName =
                [p.personne.firstName, p.personne.lastName].filter(Boolean).join(' ') ||
                'Nouveau contact';
              return (
                <article
                  key={p.id}
                  className="flex flex-col gap-3 rounded-xl border border-black/[0.08] px-4 py-3.5"
                  aria-describedby="voice-review-hint"
                >
                  <p className="font-medium text-text-strong" style={{ fontSize: 14.5 }}>
                    {displayName} · {CONTACT_TYPE_LABELS[p.personne.type]}
                  </p>
                  <Field label="Type" htmlFor={`voice-type-${p.id}`}>
                    <Select
                      id={`voice-type-${p.id}`}
                      value={p.personne.type}
                      onChange={(v) => patchPersonne(p.id, { type: v as ContactType })}
                      options={TYPE_OPTIONS}
                    />
                  </Field>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Prénom" htmlFor={`voice-fn-${p.id}`}>
                      <TextInput
                        id={`voice-fn-${p.id}`}
                        value={p.personne.firstName}
                        onChange={(e) => patchPersonne(p.id, { firstName: e.target.value })}
                        autoComplete="off"
                      />
                    </Field>
                    <Field label="Nom" htmlFor={`voice-ln-${p.id}`}>
                      <TextInput
                        id={`voice-ln-${p.id}`}
                        value={p.personne.lastName}
                        onChange={(e) => patchPersonne(p.id, { lastName: e.target.value })}
                        autoComplete="off"
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Téléphone" htmlFor={`voice-phone-${p.id}`}>
                      <TextInput
                        id={`voice-phone-${p.id}`}
                        type="tel"
                        value={p.personne.phone ?? ''}
                        onChange={(e) => patchPersonne(p.id, { phone: e.target.value.trim() || null })}
                        autoComplete="off"
                      />
                    </Field>
                    <Field label="Email" htmlFor={`voice-email-${p.id}`}>
                      <TextInput
                        id={`voice-email-${p.id}`}
                        type="email"
                        value={p.personne.email ?? ''}
                        onChange={(e) => patchPersonne(p.id, { email: e.target.value.trim() || null })}
                        autoComplete="off"
                      />
                    </Field>
                  </div>
                  {match ? (
                    <p className="text-[13px] text-text-muted">Déjà en fichier : {match.label}</p>
                  ) : p.matches.length > 1 ? (
                    <p className="text-[13px] text-text-muted">
                      Plusieurs fiches possibles. Terminer créera une nouvelle fiche.
                    </p>
                  ) : null}
                </article>
              );
            })}

            <article className="flex flex-col gap-3 rounded-xl border border-black/[0.08] px-4 py-3.5">
              <Field label="Adresse" htmlFor="voice-address">
                <AddressAutocomplete
                  id="voice-address"
                  value={review.immeuble?.adresseNormalisee ?? review.immeuble?.address ?? ''}
                  onChange={(data) => {
                    if (data) patchAdresse(data.label, data);
                  }}
                  onQueryChange={(q) => patchAdresse(q)}
                  placeholder="Rattacher à un immeuble…"
                  inputClassName={ADDRESS_FIELD_INPUT_CLASS}
                />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Surface m²" htmlFor="voice-surface">
                  <TextInput
                    id="voice-surface"
                    inputMode="numeric"
                    value={review.surface != null ? String(review.surface) : ''}
                    onChange={(e) => patchFiche({ surface: parsePositiveInt(e.target.value, 100_000) })}
                  />
                </Field>
                <Field label="Pièces" htmlFor="voice-rooms">
                  <TextInput
                    id="voice-rooms"
                    inputMode="numeric"
                    value={review.rooms != null ? String(review.rooms) : ''}
                    onChange={(e) => patchFiche({ rooms: parsePositiveInt(e.target.value, 50) })}
                  />
                </Field>
                <Field label="Prix €" htmlFor="voice-prix">
                  <TextInput
                    id="voice-prix"
                    inputMode="numeric"
                    value={review.prix != null ? String(review.prix) : ''}
                    onChange={(e) => patchFiche({ prix: parsePositiveInt(e.target.value, 100_000_000) })}
                  />
                </Field>
              </div>
            </article>

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

      <footer className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-black/[0.06] px-5 py-4 sm:px-6 lg:px-8 lg:py-5">
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          disabled={locked}
          className="min-h-[40px] text-[13.5px] font-medium text-text-muted transition-colors hover:text-text-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          Annuler
        </button>
        <WorkspaceButton type="button" onClick={terminer} disabled={locked}>
          Terminer
        </WorkspaceButton>
      </footer>

      <ConfirmModal
        open={confirmDelete}
        onClose={() => !deleting && setConfirmDelete(false)}
        onConfirm={() => void supprimer()}
        title="Annuler cette note"
        message={
          typed
            ? 'La note sera effacée. Cette action est définitive.'
            : 'La dictée et l’audio seront effacés. Cette action est définitive.'
        }
        primaryLabel="Annuler"
        secondaryLabel="Retour"
        variant="danger"
        isLoading={deleting}
      />
    </>
  );
}
