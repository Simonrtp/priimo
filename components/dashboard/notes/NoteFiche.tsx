'use client';

import { useEffect, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import type { NoteLienEntite, TerrainNote, VoiceNoteVisibilite } from '@/types/contact';
import type { NoteAttachmentProposal } from '@/lib/notes/attachment-proposals';
import type { SearchHit } from '@/lib/assistant/search';
import { SEARCH_MIN_LEN } from '@/lib/assistant/search';
import { notifyError, notifySuccess } from '@/lib/notify';
import { normalizeParcelleId } from '@/lib/carte/parcelle-id';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import { TextArea } from '@/components/dashboard/workspace/Field';

const ENTITE_LABELS: Record<NoteLienEntite, string> = {
  contact: 'Contact',
  bien: 'Bien',
  lead: 'Prospect',
  immeuble: 'Immeuble',
  parcelle: 'Parcelle',
};

const MANUAL_KINDS: { value: NoteLienEntite; label: string }[] = [
  { value: 'contact', label: 'Contact' },
  { value: 'bien', label: 'Bien' },
  { value: 'lead', label: 'Prospect' },
  { value: 'immeuble', label: 'Immeuble' },
  { value: 'parcelle', label: 'Parcelle' },
];

export default function NoteFiche({
  noteId,
  onClose,
  onChanged,
}: {
  noteId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [note, setNote] = useState<TerrainNote | null>(null);
  const [proposals, setProposals] = useState<NoteAttachmentProposal[]>([]);
  const [isAuthor, setIsAuthor] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [manualType, setManualType] = useState<NoteLienEntite>('contact');
  const [manualQ, setManualQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);

  async function load() {
    try {
      const res = await fetch(`/api/dashboard/notes/inbox/${noteId}`);
      const data = (await res.json()) as {
        note?: TerrainNote;
        proposals?: NoteAttachmentProposal[];
        isAuthor?: boolean;
        error?: string;
      };
      if (!res.ok || !data.note) throw new Error(data.error ?? 'introuvable');
      setNote(data.note);
      setProposals(data.proposals ?? []);
      setIsAuthor(Boolean(data.isAuthor));
      setTranscript(data.note.transcript ?? '');
    } catch {
      notifyError("La note n'a pas pu être ouverte");
      onClose();
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  useEffect(() => {
    if (!note?.hasAudio) {
      setAudioUrl(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/dashboard/voice-notes/${note.id}/audio`);
        const data = (await res.json()) as { url?: string };
        if (!cancelled && res.ok && data.url) setAudioUrl(data.url);
      } catch {
        /* lecture optionnelle */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [note?.hasAudio, note?.id]);

  useEffect(() => {
    if (manualType === 'parcelle' || manualType === 'immeuble') {
      setHits([]);
      return;
    }
    const q = manualQ.trim();
    if (q.length < SEARCH_MIN_LEN) {
      setHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/assistant/search?q=${encodeURIComponent(q)}`);
          const data = (await res.json()) as { hits?: SearchHit[] };
          const kind = manualType === 'lead' ? 'lead' : manualType === 'bien' ? 'bien' : 'contact';
          setHits((data.hits ?? []).filter((h) => h.kind === kind).slice(0, 6));
        } catch {
          setHits([]);
        }
      })();
    }, 220);
    return () => window.clearTimeout(t);
  }, [manualQ, manualType]);

  async function patch(body: Record<string, unknown>, okMessage?: string) {
    if (!note) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/voice-notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('patch');
      if (okMessage) notifySuccess(okMessage);
      await load();
      onChanged();
    } catch {
      notifyError("La note n'a pas pu être enregistrée");
    } finally {
      setSaving(false);
    }
  }

  async function addLien(entiteType: NoteLienEntite, entiteId: string) {
    if (!note) return;
    try {
      const res = await fetch(`/api/dashboard/voice-notes/${note.id}/liens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entiteType, entiteId, creePar: 'agent', confiance: 'certain' }),
      });
      if (!res.ok) throw new Error('lien');
      notifySuccess('Rattachement enregistré');
      setManualQ('');
      await load();
      onChanged();
    } catch {
      notifyError("Le rattachement n'a pas pu être ajouté");
    }
  }

  async function removeLien(lienId: string) {
    if (!note) return;
    try {
      const res = await fetch(`/api/dashboard/voice-notes/${note.id}/liens/${lienId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('delete');
      notifySuccess('Rattachement retiré');
      await load();
      onChanged();
    } catch {
      notifyError("Le rattachement n'a pas pu être retiré");
    }
  }

  async function acceptProposal(p: NoteAttachmentProposal) {
    await addLien(p.entiteType, p.entiteId);
  }

  async function rejectProposal(p: NoteAttachmentProposal) {
    await patch({ rejectProposal: p.key });
  }

  async function addManual() {
    if (manualType === 'parcelle') {
      const id = normalizeParcelleId(manualQ);
      if (!id) {
        notifyError('Indiquez un identifiant de parcelle à 14 caractères');
        return;
      }
      await addLien('parcelle', id);
      return;
    }
    if (manualType === 'immeuble') {
      const id = manualQ.trim();
      if (id.length < 4) {
        notifyError('Indiquez l’identifiant BAN de l’immeuble');
        return;
      }
      await addLien('immeuble', id);
    }
  }

  if (!note) {
    return (
      <Modal open onClose={onClose} title="Note" maxWidth="lg">
        <p className="py-8 text-[14px] text-text-muted">Chargement…</p>
      </Modal>
    );
  }

  const pending = proposals.filter((p) => !p.alreadyLinked && !p.rejected);
  const transcriptDirty = transcript.trim() !== (note.transcript ?? '').trim();

  return (
    <Modal open onClose={onClose} title="Note" maxWidth="lg">
      <div className="flex flex-col gap-5">
        {audioUrl ? (
          <audio controls src={audioUrl} className="w-full" preload="metadata">
            Lecture audio
          </audio>
        ) : null}

        <div>
          <label htmlFor="note-transcript" className="mb-1.5 block text-[12.5px] font-medium text-text-muted">
            Transcript
          </label>
          <TextArea
            id="note-transcript"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            disabled={!isAuthor || saving}
            rows={6}
          />
          {note.transcriptOriginal ? (
            <p className="mt-1.5 text-[12px] text-text-muted">
              Le texte brut d&apos;origine est conservé.
            </p>
          ) : null}
          {isAuthor && transcriptDirty ? (
            <WorkspaceButton
              type="button"
              className="mt-2"
              disabled={saving}
              onClick={() => void patch({ transcript }, 'Transcript enregistré')}
            >
              Enregistrer la correction
            </WorkspaceButton>
          ) : null}
        </div>

        <section>
          <h3 className="text-[13px] font-semibold text-text-strong">Rattachements</h3>
          {note.liens.length === 0 && pending.length === 0 ? (
            <p className="mt-2 text-[13.5px] text-text-muted">Aucun rattachement pour l&apos;instant.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {note.liens.map((lien) => (
                <li
                  key={lien.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-black/[0.06] px-3 py-2"
                >
                  <span className="text-[13.5px] text-text">
                    {ENTITE_LABELS[lien.entiteType]}
                    <span className="ml-2 text-text-muted">{lien.entiteId}</span>
                  </span>
                  {isAuthor ? (
                    <button
                      type="button"
                      onClick={() => void removeLien(lien.id)}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[12.5px] font-medium text-text-muted hover:bg-black/[0.04] hover:text-text"
                    >
                      <X size={14} aria-hidden />
                      Retirer
                    </button>
                  ) : null}
                </li>
              ))}
              {pending.map((p) => (
                <li
                  key={p.key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-black/[0.12] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium text-text">{p.label}</p>
                    <p className="text-[12px] text-text-muted">
                      {ENTITE_LABELS[p.entiteType]}
                      {p.subtitle ? ` · ${p.subtitle}` : ' · proposé par l’extraction'}
                    </p>
                  </div>
                  {isAuthor ? (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => void acceptProposal(p)}
                        className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[12.5px] font-semibold text-text-strong hover:bg-black/[0.04]"
                      >
                        <Check size={14} aria-hidden />
                        Accepter
                      </button>
                      <button
                        type="button"
                        onClick={() => void rejectProposal(p)}
                        className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[12.5px] font-medium text-text-muted hover:bg-black/[0.04]"
                      >
                        Rejeter
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {isAuthor ? (
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-[12.5px] font-medium text-text-muted">Ajouter à la main</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select
                  aria-label="Type de rattachement"
                  value={manualType}
                  onChange={(v) => setManualType(v as NoteLienEntite)}
                  options={MANUAL_KINDS}
                />
                <input
                  type="search"
                  value={manualQ}
                  onChange={(e) => setManualQ(e.target.value)}
                  placeholder={
                    manualType === 'parcelle'
                      ? 'Identifiant parcelle'
                      : manualType === 'immeuble'
                        ? 'Identifiant BAN'
                        : 'Rechercher'
                  }
                  className="min-h-10 flex-1 rounded-xl border border-black/8 bg-white px-3 text-[13.5px] text-text"
                />
                {manualType === 'parcelle' || manualType === 'immeuble' ? (
                  <WorkspaceButton type="button" variant="secondary" onClick={() => void addManual()}>
                    <Plus size={14} aria-hidden />
                    Lier
                  </WorkspaceButton>
                ) : null}
              </div>
              {hits.length > 0 ? (
                <ul className="overflow-hidden rounded-xl border border-black/[0.08]">
                  {hits.map((hit) => (
                    <li key={`${hit.kind}-${hit.id}`}>
                      <button
                        type="button"
                        onClick={() => void addLien(manualType, hit.id)}
                        className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-black/[0.03]"
                      >
                        <span className="text-[13.5px] font-medium text-text">{hit.label}</span>
                        {hit.subtitle ? (
                          <span className="text-[12px] text-text-muted">{hit.subtitle}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-4">
          {isAuthor ? (
            <label className="flex min-h-10 items-center gap-2 text-[13.5px] text-text">
              <input
                type="checkbox"
                checked={note.visibilite === 'privee'}
                onChange={() => {
                  const next: VoiceNoteVisibilite = note.visibilite === 'privee' ? 'agence' : 'privee';
                  void patch({ visibilite: next });
                }}
              />
              Privée — invisible pour l&apos;agence
            </label>
          ) : (
            <p className="text-[13px] text-text-muted">
              {note.visibilite === 'privee' ? 'Note privée' : 'Visible dans l’agence'}
            </p>
          )}
          {isAuthor && note.statut === 'brute' ? (
            <WorkspaceButton
              type="button"
              disabled={saving}
              onClick={() => void patch({ terminer: true }, 'Note marquée comme revue')}
            >
              Marquer comme revue
            </WorkspaceButton>
          ) : note.statut === 'revue' ? (
            <p className="text-[13px] font-medium text-text-muted">Revue</p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
