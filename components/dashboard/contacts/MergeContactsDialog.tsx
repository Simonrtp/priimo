'use client';

import { useMemo, useState } from 'react';
import type { Contact } from '@/types/contact';
import {
  MERGE_FIELDS,
  defaultMergeChoices,
  mergeFieldDisplay,
  type MergeFieldKey,
  type MergeLinkCounts,
  type MergeSide,
} from '@/lib/contacts/merge';
import { notifyError, notifySuccess } from '@/lib/notify';
import Modal from '@/components/ui/Modal';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';

function countLine(counts: MergeLinkCounts): string {
  const bits: string[] = [];
  if (counts.interactions) bits.push(`${counts.interactions} échange${counts.interactions > 1 ? 's' : ''}`);
  if (counts.notes) bits.push(`${counts.notes} note${counts.notes > 1 ? 's' : ''}`);
  if (counts.voiceNotes) bits.push(`${counts.voiceNotes} dictée${counts.voiceNotes > 1 ? 's' : ''}`);
  if (counts.biens) bits.push(`${counts.biens} bien${counts.biens > 1 ? 's' : ''}`);
  if (counts.visites) bits.push(`${counts.visites} visite${counts.visites > 1 ? 's' : ''}`);
  if (counts.offres) bits.push(`${counts.offres} offre${counts.offres > 1 ? 's' : ''}`);
  if (counts.promesses) bits.push(`${counts.promesses} promesse${counts.promesses > 1 ? 's' : ''}`);
  if (counts.rendezVous) bits.push(`${counts.rendezVous} rendez-vous`);
  if (counts.alerts) bits.push(`${counts.alerts} alerte${counts.alerts > 1 ? 's' : ''}`);
  return bits.join(', ') || 'aucun lien';
}

function displayValue(
  contact: Contact,
  key: MergeFieldKey,
  members: readonly AssigneeOption[],
): string {
  if (key === 'assignedTo') {
    const id = contact.assignedTo;
    if (!id) return '—';
    return members.find((m) => m.id === id)?.fullName ?? id;
  }
  const v = mergeFieldDisplay(contact, key).trim();
  return v || '—';
}

export default function MergeContactsDialog({
  keep,
  absorb,
  members,
  onClose,
  onMerged,
}: {
  keep: Contact;
  absorb: Contact;
  members: readonly AssigneeOption[];
  onClose: () => void;
  onMerged: (kept: Contact, absorbedId: string, transferred: MergeLinkCounts) => void;
}) {
  const [left, setLeft] = useState(keep);
  const [right, setRight] = useState(absorb);
  const [choices, setChoices] = useState(() => defaultMergeChoices(keep, absorb));
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{
    transferred: MergeLinkCounts;
    beforeAbsorb: MergeLinkCounts;
    afterKeep: MergeLinkCounts;
  } | null>(null);

  const differing = useMemo(
    () =>
      MERGE_FIELDS.filter(
        (f) => mergeFieldDisplay(left, f.key).trim() !== mergeFieldDisplay(right, f.key).trim(),
      ),
    [left, right],
  );

  function swap() {
    setLeft(right);
    setRight(left);
    setChoices(defaultMergeChoices(right, left));
  }

  async function submit() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/contacts/${left.id}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ absorbId: right.id, fields: choices }),
      });
      const data = (await res.json()) as {
        contact?: Contact;
        error?: string;
        counts?: {
          before?: { absorb?: MergeLinkCounts };
          after?: { keep?: MergeLinkCounts };
          transferred?: MergeLinkCounts;
        };
      };
      if (!res.ok || !data.contact || !data.counts?.transferred) {
        notifyError(data.error ?? 'La fusion n’a pas pu aboutir');
        return;
      }
      setResult({
        transferred: data.counts.transferred,
        beforeAbsorb: data.counts.before?.absorb ?? data.counts.transferred,
        afterKeep: data.counts.after?.keep ?? data.counts.transferred,
      });
      onMerged(data.contact, right.id, data.counts.transferred);
      notifySuccess('Fiches fusionnées');
    } catch {
      notifyError('La fusion n’a pas pu aboutir');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Fusionner les doublons" maxWidth="2xl">
      {result ? (
        <div className="flex flex-col gap-4">
          <p className="text-pretty text-[14px] text-text">
            Conservé : <span className="font-semibold">{left.fullName}</span>. Absorbé puis
            supprimé : {right.fullName}.
          </p>
          <p className="text-pretty text-[13.5px] text-text-muted">
            Avant report sur la fiche absorbée : {countLine(result.beforeAbsorb)}. Reporté :{' '}
            {countLine(result.transferred)}. Après fusion sur la fiche conservée :{' '}
            {countLine(result.afterKeep)}.
          </p>
          <div className="flex justify-end">
            <WorkspaceButton type="button" onClick={onClose}>
              Fermer
            </WorkspaceButton>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-pretty text-[13.5px] text-text-muted">
            Choisissez la valeur à garder pour chaque champ. Notes, échanges, biens et leads sont
            reportés sur la fiche conservée, puis l’autre est supprimée.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-black/[0.08] bg-white px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-subtle">
                Conservée
              </p>
              <p className="mt-1 font-semibold text-text-strong" style={{ fontSize: 15 }}>
                {left.fullName}
              </p>
            </div>
            <div className="rounded-xl border border-black/[0.08] bg-white px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-subtle">
                Absorbée
              </p>
              <p className="mt-1 font-semibold text-text-strong" style={{ fontSize: 15 }}>
                {right.fullName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={swap}
            className="self-start text-[13px] font-medium text-[#3D5A80] underline-offset-2 hover:underline"
          >
            Inverser : conserver {right.fullName}
          </button>

          <ul className="max-h-[50vh] overflow-y-auto rounded-xl border border-black/[0.08]">
            {(differing.length > 0 ? differing : MERGE_FIELDS).map(({ key, label }) => (
              <li
                key={key}
                className="grid grid-cols-[7.5rem_1fr_1fr] gap-2 border-b border-black/[0.06] px-3 py-2.5 last:border-b-0"
              >
                <p className="pt-1 text-[12.5px] font-medium text-text-muted">{label}</p>
                <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1 hover:bg-[#FFF7F0]">
                  <input
                    type="radio"
                    name={`merge-${key}`}
                    checked={choices[key] === 'keep'}
                    onChange={() => setChoices((c) => ({ ...c, [key]: 'keep' as MergeSide }))}
                    className="mt-1"
                  />
                  <span className="min-w-0 break-words text-[13px] text-text">
                    {displayValue(left, key, members)}
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1 hover:bg-[#FFF7F0]">
                  <input
                    type="radio"
                    name={`merge-${key}`}
                    checked={choices[key] === 'absorb'}
                    onChange={() => setChoices((c) => ({ ...c, [key]: 'absorb' as MergeSide }))}
                    className="mt-1"
                  />
                  <span className="min-w-0 break-words text-[13px] text-text">
                    {displayValue(right, key, members)}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap justify-end gap-3 border-t border-black/[0.06] pt-4">
            <WorkspaceButton type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Annuler
            </WorkspaceButton>
            <WorkspaceButton type="button" onClick={() => void submit()} disabled={saving}>
              {saving ? 'Fusion…' : `Conserver ${left.fullName}`}
            </WorkspaceButton>
          </div>
        </div>
      )}
    </Modal>
  );
}
