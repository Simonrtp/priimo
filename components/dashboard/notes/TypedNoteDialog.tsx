'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NotebookPen, X } from 'lucide-react';
import TypedNoteGuide, { type TypedNoteSubmitPayload } from '@/components/dashboard/notes/TypedNoteGuide';
import { useDevice } from '@/components/dashboard/device/DeviceProvider';
import { readDevicePosition } from '@/lib/voice/gps';
import { emitNoteCreated } from '@/lib/notes/note-created-event';
import { notifyError, notifySuccess } from '@/lib/notify';

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
  const field = device === 'mobile';

  const [deviceCoords, setDeviceCoords] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void readDevicePosition().then((pos) => {
      if (pos) setDeviceCoords((prev) => prev ?? pos);
    });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

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
          liens: payload.liens.map((l) => ({
            entiteType: l.entiteType,
            entiteId: l.entiteId,
          })),
        }),
      });
      const data = (await res.json()) as { error?: string; voiceNoteId?: string };
      if (!res.ok) throw new Error(data.error ?? 'save');
      emitNoteCreated({ noteId: data.voiceNoteId ?? null, source: 'clavier' });
      notifySuccess('Votre note a bien été enregistrée', {
        id: data.voiceNoteId ? `note-saved-${data.voiceNoteId}` : undefined,
      });
      if (!resterSurPage) router.refresh();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error && err.message !== 'save'
          ? err.message
          : "La note n'a pas pu être enregistrée";
      setError(message);
      notifyError(message);
    } finally {
      setSaving(false);
    }
  }

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

  if (field) {
    return (
      <div
        className="fixed inset-0 z-[220] flex flex-col bg-bg-base"
        role="dialog"
        aria-modal="true"
        aria-label="Écrire une note"
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
            Écrire une note
          </p>
          <span className="w-11" aria-hidden />
        </header>
        {form}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-[rgba(21,32,47,0.45)] p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Écrire une note"
    >
      <div className="flex max-h-[90vh] w-full max-w-[500px] flex-col overflow-hidden rounded-clay-lg bg-surface shadow-clay-lg">
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
            <NotebookPen size={18} strokeWidth={2} className="shrink-0 text-accent" aria-hidden />
            <h2 className="min-w-0 flex-1 text-balance font-semibold text-text-strong" style={{ fontSize: 16 }}>
              Écrire une note
            </h2>
          </div>
        </header>
        {form}
      </div>
    </div>
  );
}
