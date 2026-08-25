'use client';

import { useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NotebookPen, X } from 'lucide-react';
import AddressAutocomplete, { type SelectedAddress } from '@/components/AddressAutocomplete';
import { Field, TextArea } from '@/components/dashboard/workspace/Field';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import VoiceReviewPanel from '@/components/dashboard/voice/VoiceReviewPanel';
import { useDevice } from '@/components/dashboard/device/DeviceProvider';
import { useUser } from '@/lib/hooks/useUser';
import { notifySuccess } from '@/lib/notify';
import { readDevicePosition } from '@/lib/voice/gps';
import { reverseGeocode } from '@/lib/geo/ban';
import type { NameMatchMember } from '@/lib/agency/match-member';
import type { NoteReviewPayload } from '@/lib/notes/build-review';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';

const fieldInputClass =
  'w-full rounded-xl border border-black/[0.10] bg-surface py-2.5 pl-10 pr-10 text-[14px] text-text outline-none transition-colors placeholder:text-text-subtle focus:border-accent/50 focus:ring-2 focus:ring-accent/15';

export default function TypedNoteDialog({
  onClose,
  adresse = null,
  parcelleIdu = null,
}: {
  onClose: () => void;
  adresse?: string | null;
  parcelleIdu?: string | null;
}) {
  const router = useRouter();
  const device = useDevice();
  const { profile } = useUser();
  const textId = useId();
  const addrId = useId();
  const field = device === 'mobile';

  const [text, setText] = useState('');
  const [adresseLabel, setAdresseLabel] = useState(adresse?.trim() ?? '');
  const [deviceCoords, setDeviceCoords] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [banCoords, setBanCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<NoteReviewPayload | null>(null);
  const [transcript, setTranscript] = useState('');
  const [members, setMembers] = useState<NameMatchMember[]>([]);
  const [suggestedAssigneeId, setSuggestedAssigneeId] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (adresse) setAdresseLabel(adresse.trim());
    void readDevicePosition().then(async (pos) => {
      if (!pos) return;
      setDeviceCoords((prev) => prev ?? pos);
      if (adresse) return;
      const hit = await reverseGeocode(pos.latitude, pos.longitude);
      if (hit) setAdresseLabel((current) => current || hit.adresse_normalisee);
    });
  }, [adresse]);

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
      if (e.key === 'Escape' && !saving && !closing && !review) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving, closing, review]);

  function onAddress(data: SelectedAddress | null) {
    if (!data) {
      setBanCoords(null);
      return;
    }
    setAdresseLabel(data.label);
    setBanCoords({ latitude: data.latitude, longitude: data.longitude });
  }

  async function submit() {
    const body = text.trim();
    if (body.length < 8) {
      setError('Écrivez un peu plus pour enregistrer la note.');
      return;
    }
    setSaving(true);
    setError(null);
    const coords = banCoords ?? deviceCoords;
    try {
      const res = await fetch('/api/dashboard/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: body,
          adresse: adresseLabel.trim() || undefined,
          latitude: coords?.latitude,
          longitude: coords?.longitude,
          parcelleIdu: parcelleIdu || undefined,
        }),
      });
      const data = (await res.json()) as NoteReviewPayload & {
        error?: string;
        suggestedAssignee?: { id: string } | null;
      };
      if (!res.ok) throw new Error(data.error ?? 'save');
      setTranscript(data.transcript ?? body);
      setSuggestedAssigneeId(data.suggestedAssignee?.id ?? null);
      setReview(data);
    } catch (err) {
      setError(err instanceof Error && err.message !== 'save' ? err.message : "La note n'a pas pu être enregistrée");
    } finally {
      setSaving(false);
    }
  }

  async function terminer(contactId?: string | null) {
    const id = review?.voiceNoteId;
    if (!id || closing) return;
    setClosing(true);
    try {
      await fetch(`/api/dashboard/voice-notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ terminer: true }),
      });
    } catch {
      /* déjà en base */
    }
    notifySuccess('Note enregistrée');
    router.refresh();
    onClose();
    if (contactId) router.push(`/dashboard/contacts?fiche=${contactId}`);
  }

  const memberOptions: AssigneeOption[] = members.map((m) => ({
    id: m.id,
    fullName: m.fullName,
  }));

  const form = (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 sm:px-6">
      <Field
        label="Adresse"
        htmlFor={addrId}
        hint="Optionnel — pour rattacher la note à un immeuble."
      >
        <AddressAutocomplete
          id={addrId}
          value={adresseLabel}
          onChange={onAddress}
          onQueryChange={(q) => setAdresseLabel(q)}
          placeholder="Rue, numéro, ville…"
          inputClassName={fieldInputClass}
        />
      </Field>
      <Field label="Note" htmlFor={textId}>
        <TextArea
          id={textId}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
          }}
          rows={field ? 10 : 8}
          placeholder="Ce que vous venez de vivre, ce qu’il faut retenir…"
          autoFocus
        />
      </Field>
      {error ? (
        <p className="text-pretty text-[13.5px] text-text" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-auto flex gap-2.5 pt-2">
        <WorkspaceButton type="button" variant="secondary" onClick={onClose} className="flex-1 sm:flex-none">
          Annuler
        </WorkspaceButton>
        <WorkspaceButton
          type="button"
          onClick={() => void submit()}
          disabled={saving}
          className="flex-1 sm:flex-none"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </WorkspaceButton>
      </div>
    </div>
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
        saving={closing}
        typed
        onDone={(contactId) => void terminer(contactId)}
        onDiscard={() => {
          router.refresh();
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
          review ? 'max-w-[1040px]' : 'max-w-[440px]'
        }`}
      >
        <header className="flex flex-shrink-0 items-center gap-3 border-b border-black/[0.06] px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg text-text-subtle transition-colors hover:bg-black/[0.04] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
