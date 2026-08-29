'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NotebookPen, X } from 'lucide-react';
import VoiceReviewPanel from '@/components/dashboard/voice/VoiceReviewPanel';
import TypedNoteGuide, { type TypedNoteSubmitPayload } from '@/components/dashboard/notes/TypedNoteGuide';
import { useDevice } from '@/components/dashboard/device/DeviceProvider';
import { useUser } from '@/lib/hooks/useUser';
import { readDevicePosition } from '@/lib/voice/gps';
import type { NameMatchMember } from '@/lib/agency/match-member';
import type { NoteReviewPayload } from '@/lib/notes/build-review';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import { emitNoteCreated } from '@/lib/notes/note-created-event';

export default function TypedNoteDialog({
  onClose,
  adresse = null,
  parcelleId = null,
  resterSurPage = false,
}: {
  onClose: () => void;
  adresse?: string | null;
  parcelleId?: string | null;
  resterSurPage?: boolean;
}) {
  const router = useRouter();
  const device = useDevice();
  const { profile } = useUser();
  const field = device === 'mobile';

  const [deviceCoords, setDeviceCoords] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<NoteReviewPayload | null>(null);
  const [transcript, setTranscript] = useState('');
  const [members, setMembers] = useState<NameMatchMember[]>([]);
  const [suggestedAssigneeId, setSuggestedAssigneeId] = useState<string | null>(null);

  useEffect(() => {
    void readDevicePosition().then((pos) => {
      if (pos) setDeviceCoords((prev) => prev ?? pos);
    });
  }, []);

  useEffect(() => {
    if (!review) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/team');
        const data = (await res.json()) as { members?: NameMatchMember[] };
        if (!cancelled) setMembers(data.members ?? []);
      } catch {
        if (!cancelled) setMembers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [review]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving && !review) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving, review]);

  async function submit(payload: TypedNoteSubmitPayload) {
    setSaving(true);
    setError(null);
    const coords = payload.banCoords ?? deviceCoords;
    try {
      const res = await fetch('/api/dashboard/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: payload.transcript,
          draft: payload.draft,
          adresse: payload.adresse || undefined,
          latitude: coords?.latitude,
          longitude: coords?.longitude,
          parcelleId: parcelleId || undefined,
        }),
      });
      const data = (await res.json()) as NoteReviewPayload & {
        error?: string;
        suggestedAssignee?: { id: string } | null;
      };
      if (!res.ok) throw new Error(data.error ?? 'save');
      emitNoteCreated({ noteId: data.voiceNoteId ?? null, source: 'clavier' });
      setTranscript(data.transcript ?? payload.transcript);
      setSuggestedAssigneeId(data.suggestedAssignee?.id ?? null);
      setReview(data);
    } catch (err) {
      setError(
        err instanceof Error && err.message !== 'save'
          ? err.message
          : "La note n'a pas pu être enregistrée",
      );
    } finally {
      setSaving(false);
    }
  }

  function onReviewDone(contactId?: string | null) {
    if (resterSurPage) {
      onClose();
      return;
    }
    router.refresh();
    if (contactId) router.push(`/dashboard/contacts?fiche=${contactId}`);
  }

  const memberOptions: AssigneeOption[] = members.map((m) => ({
    id: m.id,
    fullName: m.fullName,
  }));

  const form = (
    <TypedNoteGuide
      field={field}
      initialAdresse={adresse?.trim() ?? ''}
      saving={saving}
      error={error}
      onCancel={onClose}
      onSubmit={(payload) => void submit(payload)}
    />
  );

  const reviewPanel =
    review ? (
      <VoiceReviewPanel
        review={review}
        transcript={transcript}
        onTranscript={setTranscript}
        onReviewChange={setReview}
        members={memberOptions}
        currentUserId={profile?.id}
        suggestedAssigneeId={suggestedAssigneeId}
        typed
        onDismiss={onClose}
        onDone={onReviewDone}
        onDiscard={() => {
          if (!resterSurPage) router.refresh();
          onClose();
        }}
      />
    ) : null;

  if (field) {
    return (
      <div
        className="fixed inset-0 z-[120] flex flex-col bg-bg-base"
        role="dialog"
        aria-modal="true"
        aria-label={review ? 'Vérifiez la note' : 'Écrire une note'}
        style={{ height: '100dvh' }}
      >
        <header
          className="flex flex-shrink-0 items-center justify-between px-4"
          style={{ paddingTop: 'calc(8px + env(safe-area-inset-top, 0px))' }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="app-press flex size-11 items-center justify-center rounded-lg text-text-muted"
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
          <p className="font-semibold text-text-strong" style={{ fontSize: 16 }}>
            {review ? 'Vérifiez la note' : 'Écrire une note'}
          </p>
          <span className="w-11" aria-hidden />
        </header>
        {review ? reviewPanel : form}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(21,32,47,0.45)] p-4"
      role="dialog"
      aria-modal="true"
      aria-label={review ? 'Vérifiez la note' : 'Écrire une note'}
    >
      <div
        className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-clay-lg bg-surface shadow-clay-lg ${
          review ? 'max-w-[1040px]' : 'max-w-[500px]'
        }`}
      >
        <header className="flex flex-shrink-0 items-center gap-3 border-b border-black/[0.06] px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg text-text-subtle transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.04] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {!review ? (
              <NotebookPen size={18} strokeWidth={2} className="shrink-0 text-accent" aria-hidden />
            ) : null}
            <h2 className="min-w-0 flex-1 text-balance font-semibold text-text-strong" style={{ fontSize: 16 }}>
              {review ? 'Vérifiez la note' : 'Écrire une note'}
            </h2>
          </div>
        </header>
        {review ? reviewPanel : form}
      </div>
    </div>
  );
}
