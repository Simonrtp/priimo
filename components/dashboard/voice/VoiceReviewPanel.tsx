'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { ContactType, NoteSourceInfo, VoiceNoteVisibilite } from '@/types/contact';
import { CONTACT_TYPE_LABELS, NOTE_SOURCE_LABELS } from '@/types/contact';
import type { NoteReviewPayload, PersonneProposal } from '@/lib/notes/build-review';
import type { ContactMatch } from '@/lib/notes/match';
import { notifyError, notifySuccess } from '@/lib/notify';
import Select from '@/components/ui/Select';
import ConfirmModal from '@/components/ui/ConfirmModal';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import AssigneeSelect, { type AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import { Field, TextArea } from '@/components/dashboard/workspace/Field';

const SOURCE_OPTIONS = [
  { value: '', label: 'Non précisé' },
  ...Object.entries(NOTE_SOURCE_LABELS).map(([value, label]) => ({ value, label })),
];

function personTitle(p: PersonneProposal['personne']): string {
  const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Personne';
  const type = CONTACT_TYPE_LABELS[p.type as ContactType];
  return type ? `${name} · ${type}` : name;
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
  saving,
  onContinue,
  onDone,
  onDiscard,
}: {
  review: NoteReviewPayload;
  transcript: string;
  onTranscript: (v: string) => void;
  onReviewChange: (review: NoteReviewPayload) => void;
  members: readonly AssigneeOption[];
  currentUserId?: string;
  suggestedAssigneeId: string | null;
  saving: boolean;
  onContinue: () => void;
  onDone: (contactId?: string | null) => void;
  onDiscard: () => void;
}) {
  const [visibilite, setVisibilite] = useState<VoiceNoteVisibilite>(review.visibilite);
  const [sourceInfo, setSourceInfo] = useState<NoteSourceInfo | ''>(review.sourceInfo ?? '');
  const [relanceAssignee, setRelanceAssignee] = useState<string | null>(suggestedAssigneeId);
  const [promesseAssignee, setPromesseAssignee] = useState<string | null>(suggestedAssigneeId);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const lastExtracted = (review.transcript ?? '').trim();
  const dirty = transcript.trim() !== lastExtracted;
  const canRefresh = transcript.trim().length > 0 && (dirty || review.extractFailed);
  const locked = saving || busy || refreshing || deleting;

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

  async function createContact(p: PersonneProposal): Promise<string> {
    const address = review.immeuble?.adresseNormalisee ?? review.immeuble?.address ?? null;
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
        secteur: review.secteur,
        budgetMax: review.prix,
        roomsMin: review.rooms,
        surfaceMin: review.surface,
        summary: transcript.trim() || null,
        source: 'vocal',
        voiceNoteId: review.voiceNoteId,
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

  async function terminer() {
    if (locked) return;
    setBusy(true);
    try {
      let contactId: string | null = null;
      for (const p of review.personnes) {
        const match = pickMatch(p.matches);
        if (match) {
          try {
            await addLien('contact', match.contactId, match.confiance);
          } catch {
            // Le rattachement se fera à la réconciliation.
          }
          contactId = contactId ?? match.contactId;
        } else if (p.personne.firstName || p.personne.lastName) {
          contactId = contactId ?? (await createContact(p));
        }
      }
      if (review.immeuble?.banId && review.immeuble.confiance) {
        try {
          await addLien('immeuble', review.immeuble.banId, review.immeuble.confiance);
        } catch {
          // La note reste, l’immeuble pourra être rattaché plus tard.
        }
      }
      if (review.relance) {
        try {
          await patchNote({
            relance: { at: review.relance.at, assignedTo: relanceAssignee },
          });
        } catch {
          // La relance n’est pas bloquante.
        }
      }
      const metierPayload: Record<string, unknown> = { contactId };
      if (review.promesse?.accepted) {
        metierPayload.promesse = {
          accepted: true,
          intitule: review.promesse.intitule,
          echeance: review.promesse.echeance,
          assignedTo: promesseAssignee,
        };
      }
      if (review.rendezVous?.accepted) {
        metierPayload.rendezVous = { ...review.rendezVous, accepted: true };
      }
      if (review.visite?.accepted) {
        metierPayload.visite = { ...review.visite, accepted: true };
      }
      if (review.promesse?.accepted || review.rendezVous?.accepted || review.visite?.accepted) {
        try {
          const res = await fetch(`/api/dashboard/voice-notes/${review.voiceNoteId}/metier`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(metierPayload),
          });
          if (!res.ok) throw new Error('metier');
        } catch {
          notifyError('Engagement ou rendez-vous non enregistré');
        }
      }
      onDone(contactId);
    } catch {
      notifyError("Le contact n'a pas pu être créé");
      setBusy(false);
    }
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

  const showImmeubleSeul = Boolean(review.immeuble) && review.personnes.length === 0;

  return (
    <>
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col overflow-y-auto border-b border-black/[0.06] bg-bg-subtle px-5 py-5 sm:px-6 lg:border-b-0 lg:border-r lg:px-8 lg:py-6">
          <h3
            className="mb-4 font-semibold uppercase text-text-subtle"
            style={{ fontSize: 11, letterSpacing: '0.08em' }}
          >
            Ce que vous avez dit
          </h3>
          <label htmlFor="voice-transcript" className="sr-only">
            Transcription de la dictée
          </label>
          <TextArea
            id="voice-transcript"
            value={transcript}
            onChange={(e) => onTranscript(e.target.value)}
            rows={8}
            placeholder="La transcription n'a rien donné. Écrivez ici ce que vous vouliez noter."
            className="flex-1 lg:min-h-[280px]"
          />
          <p className="mt-3 text-pretty text-text-muted" style={{ fontSize: 13, lineHeight: 1.45 }}>
            Corrigez votre phrase si besoin, puis mettez à jour.
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
            <button
              type="button"
              onClick={onContinue}
              disabled={locked}
              className="min-h-[40px] text-[13.5px] font-medium text-text-muted transition-colors hover:text-text-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              Compléter la dictée
            </button>
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

            {review.personnes.length === 0 &&
            !review.immeuble &&
            !review.relance &&
            !review.promesse &&
            !review.rendezVous &&
            !review.visite ? (
              <p className="text-pretty text-text-muted" style={{ fontSize: 14 }}>
                Rien à rattacher. Terminer conserve la note telle quelle.
              </p>
            ) : null}

            {review.personnes.map((p) => {
              const match = pickMatch(p.matches);
              const extras = [p.personne.phone, p.personne.email].filter(Boolean);
              return (
                <article key={p.id} className="rounded-xl border border-black/[0.08] px-4 py-3.5">
                  <p className="font-medium text-text-strong" style={{ fontSize: 14.5 }}>
                    {personTitle(p.personne)}
                  </p>
                  {extras.map((line) => (
                    <p key={line} className="mt-1 text-[13px] text-text-muted">
                      {line}
                    </p>
                  ))}
                  {review.details.map((line) => (
                    <p key={line} className="mt-1 text-[13.5px] text-text" style={{ lineHeight: 1.45 }}>
                      {line}
                    </p>
                  ))}
                  {match ? (
                    <p className="mt-2 text-[13px] text-text-muted">
                      Déjà en fichier : {match.label}
                    </p>
                  ) : p.matches.length > 1 ? (
                    <p className="mt-2 text-[13px] text-text-muted">
                      Plusieurs fiches possibles. Terminer créera une nouvelle fiche.
                    </p>
                  ) : null}
                </article>
              );
            })}

            {showImmeubleSeul ? (
              <article className="rounded-xl border border-black/[0.08] px-4 py-3.5">
                <p className="font-medium text-text-strong" style={{ fontSize: 14.5 }}>
                  {review.immeuble?.adresseNormalisee ?? review.immeuble?.address}
                </p>
                {review.details
                  .filter((line) => line !== (review.immeuble?.adresseNormalisee ?? review.immeuble?.address))
                  .map((line) => (
                    <p key={line} className="mt-1 text-[13.5px] text-text" style={{ lineHeight: 1.45 }}>
                      {line}
                    </p>
                  ))}
              </article>
            ) : null}

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
        <WorkspaceButton type="button" onClick={() => void terminer()} disabled={locked}>
          {busy || saving ? 'Enregistrement…' : 'Terminer'}
        </WorkspaceButton>
      </footer>

      <ConfirmModal
        open={confirmDelete}
        onClose={() => !deleting && setConfirmDelete(false)}
        onConfirm={() => void supprimer()}
        title="Annuler cette note"
        message="La dictée et l’audio seront effacés. Cette action est définitive."
        primaryLabel="Annuler"
        secondaryLabel="Retour"
        variant="danger"
        isLoading={deleting}
      />
    </>
  );
}
