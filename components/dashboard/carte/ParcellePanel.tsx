'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Mic, X } from 'lucide-react';
import NotesTerrainList from '@/components/dashboard/notes/NotesTerrainList';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import { TextArea } from '@/components/dashboard/workspace/Field';
import { useVoiceCapture } from '@/components/dashboard/voice/VoiceCaptureProvider';
import { useUser } from '@/lib/hooks/useUser';
import { notifyError, notifySuccess } from '@/lib/notify';
import type { ParcelleAgencyItem, ParcelleFiche } from '@/lib/carte/parcelle';

const KIND_LABEL: Record<ParcelleAgencyItem['kind'], string> = {
  lead: 'Prospects',
  contact: 'Contacts',
  bien: 'Biens',
  note: 'Notes',
};

function euros(n: number | null): string {
  if (n === null) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

function groupAgency(items: readonly ParcelleAgencyItem[]) {
  const order: ParcelleAgencyItem['kind'][] = ['lead', 'contact', 'bien', 'note'];
  return order
    .map((kind) => ({ kind, items: items.filter((i) => i.kind === kind) }))
    .filter((g) => g.items.length > 0);
}

export default function ParcellePanel({
  fiche,
  onClose,
  onNotesChanged,
}: {
  fiche: ParcelleFiche;
  onClose: () => void;
  onNotesChanged?: () => void;
}) {
  const { openCapture, captureSessionOpen } = useVoiceCapture();
  const { profile } = useUser();
  const textId = useId();
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [noteTick, setNoteTick] = useState(0);
  const captureWasOpen = useRef(false);

  useEffect(() => {
    if (captureSessionOpen) {
      captureWasOpen.current = true;
      return;
    }
    if (!captureWasOpen.current) return;
    captureWasOpen.current = false;
    setNoteTick((n) => n + 1);
    onNotesChanged?.();
  }, [captureSessionOpen, onNotesChanged]);

  const title = fiche.adresse ?? fiche.reference;

  async function saveTyped() {
    const body = draft.trim();
    if (body.length < 8) {
      notifyError('Écrivez un peu plus pour enregistrer la note.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/dashboard/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: body,
          adresse: fiche.adresse ?? undefined,
          parcelleId: fiche.parcelleId,
        }),
      });
      const data = (await res.json()) as { error?: string; voiceNoteId?: string };
      if (!res.ok) throw new Error(data.error ?? 'save');
      if (data.voiceNoteId) {
        await fetch(`/api/dashboard/voice-notes/${data.voiceNoteId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ terminer: true }),
        });
      }
      setDraft('');
      notifySuccess('Note enregistrée');
      setNoteTick((n) => n + 1);
      onNotesChanged?.();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "La note n'a pas pu être enregistrée");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-black/[0.05] px-5 pb-4 pt-5 sm:px-7">
        <div className="min-w-0">
          <h2 id="parcelle-title" className="text-balance font-semibold text-text-strong" style={{ fontSize: 18 }}>
            {title}
          </h2>
          <p className="mt-1 text-pretty text-[12.5px] text-text-muted">
            Plan cadastral indicatif — sans valeur juridique
          </p>
          {fiche.adresse ? (
            <p className="mt-1 font-medium tabular-nums text-[12.5px] text-text-subtle">{fiche.reference}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-text-subtle transition-colors hover:bg-black/[0.05] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <X size={18} strokeWidth={2} aria-hidden />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
        {fiche.videPublic ? (
          <p className="text-pretty text-[14px] text-text-muted">
            Aucune information publique sur cette parcelle
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {fiche.ventes.length > 0 ? (
              <section>
                <h3 className="mb-2 font-semibold uppercase text-text-subtle" style={{ fontSize: 11 }}>
                  Ventes
                  <span className="ml-1.5 tabular-nums">{fiche.ventes.length}</span>
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="text-text-subtle">
                        <th scope="col" className="py-1.5 pr-3 font-medium">Date</th>
                        <th scope="col" className="py-1.5 pr-3 font-medium">Prix</th>
                        <th scope="col" className="py-1.5 pr-3 font-medium">Surface</th>
                        <th scope="col" className="py-1.5 font-medium">€/m²</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fiche.ventes.map((v, i) => (
                        <tr key={`${v.date}-${i}`} className="border-t border-black/[0.06] text-text">
                          <td className="py-2 pr-3 tabular-nums">{formatDay(v.date)}</td>
                          <td className="py-2 pr-3 tabular-nums">{euros(v.prix)}</td>
                          <td className="py-2 pr-3 tabular-nums">{v.surface !== null ? `${v.surface} m²` : '—'}</td>
                          <td className="py-2 tabular-nums">{euros(v.prixM2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {fiche.diagnostics.length > 0 ? (
              <section>
                <h3 className="mb-2 font-semibold uppercase text-text-subtle" style={{ fontSize: 11 }}>
                  Diagnostics
                  <span className="ml-1.5 tabular-nums">{fiche.diagnostics.length}</span>
                </h3>
                <ul className="flex flex-col gap-1">
                  {fiche.diagnostics.map((d, i) => (
                    <li key={`${d.date}-${d.etiquette}-${i}`} className="text-[13.5px] text-text">
                      {d.etiquette ? <span className="font-semibold">{d.etiquette}</span> : null}
                      {d.type && d.type.toUpperCase() !== 'DPE' ? (
                        <span className="text-text-muted"> {d.type}</span>
                      ) : null}
                      {d.date ? (
                        <span className="ml-2 tabular-nums text-text-subtle">{formatDay(d.date)}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {fiche.coproprietes.length > 0 ? (
              <section>
                <h3 className="mb-2 font-semibold uppercase text-text-subtle" style={{ fontSize: 11 }}>
                  Copropriété
                  <span className="ml-1.5 tabular-nums">{fiche.coproprietes.length}</span>
                </h3>
                <ul className="flex flex-col gap-3 text-[13.5px] text-text">
                  {fiche.coproprietes.map((copro, i) => (
                    <li key={`${copro.numeroImmatriculation ?? 'copro'}-${i}`}>
                      {copro.numeroImmatriculation ? (
                        <p className="font-medium tabular-nums">{copro.numeroImmatriculation}</p>
                      ) : null}
                      {copro.lots != null ? (
                        <p>
                          <span className="tabular-nums">{copro.lots}</span> lots
                        </p>
                      ) : null}
                      {copro.periodeConstruction ? (
                        <p>Période de construction : {copro.periodeConstruction}</p>
                      ) : null}
                      {copro.procedureEnCours ? (
                        <p>Procédure en cours</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}

        {fiche.surCetteParcelle.length > 0 ? (
          <section className="mt-6">
            <h3 className="mb-2 font-semibold uppercase text-text-subtle" style={{ fontSize: 11 }}>
              Sur cette parcelle
            </h3>
            {groupAgency(fiche.surCetteParcelle).map((group) => (
              <div key={group.kind} className="mb-3">
                <p className="text-[12.5px] font-medium text-text-muted">{KIND_LABEL[group.kind]}</p>
                <ul className="mt-1 flex flex-col">
                  {group.items.map((item) => (
                    <li key={`${item.kind}:${item.id}`}>
                      <Link
                        href={item.href}
                        className="block rounded-xl px-2 py-2 hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        <p className="truncate text-[14px] font-medium text-text-strong">{item.title}</p>
                        {item.subtitle ? (
                          <p className="mt-0.5 truncate text-[12.5px] text-text-muted">{item.subtitle}</p>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ) : null}

        <section className="mt-6 border-t border-black/[0.06] pt-5">
          <h3 className="mb-3 font-semibold uppercase text-text-subtle" style={{ fontSize: 11 }}>
            Notes
          </h3>
          <NotesTerrainList
            key={`${fiche.parcelleId}:${noteTick}`}
            entiteType="parcelle"
            entiteId={fiche.parcelleId}
            currentUserId={profile?.id}
          />
          <div className="mt-4 flex flex-col gap-2.5">
            <WorkspaceButton
              type="button"
              onClick={() =>
                openCapture({
                  adresse: fiche.adresse ?? fiche.reference,
                  parcelleId: fiche.parcelleId,
                })
              }
            >
              <Mic size={16} strokeWidth={2} aria-hidden />
              Dicter
            </WorkspaceButton>
            <label htmlFor={textId} className="sr-only">
              Note écrite rapide
            </label>
            <TextArea
              id={textId}
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Note écrite rapide…"
            />
            <WorkspaceButton type="button" variant="secondary" onClick={() => void saveTyped()} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer la note'}
            </WorkspaceButton>
          </div>
        </section>
      </div>
    </div>
  );
}

export function ParcelleDrawer({
  fiche,
  loading,
  onClose,
  onNotesChanged,
}: {
  fiche: ParcelleFiche | null;
  loading: boolean;
  onClose: () => void;
  onNotesChanged?: () => void;
}) {
  const [entered, setEntered] = useState(false);
  const [settled, setSettled] = useState(false);
  const open = Boolean(fiche) || loading;

  useEffect(() => {
    if (!open) {
      setEntered(false);
      setSettled(false);
      return;
    }
    setEntered(false);
    setSettled(false);
    const enter = window.setTimeout(() => setEntered(true), 16);
    const settle = window.setTimeout(() => setSettled(true), 220);
    return () => {
      window.clearTimeout(enter);
      window.clearTimeout(settle);
    };
  }, [open, fiche?.parcelleId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const panel = (
    <>
      <div
        role="presentation"
        className={`fixed inset-x-0 bottom-0 z-40 hidden transition-opacity duration-200 ease-out md:block ${
          entered ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ top: 'var(--dashboard-topbar-height)', backgroundColor: 'rgba(0,0,0,0.15)' }}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={`fixed inset-0 z-50 flex h-dvh max-h-dvh w-full flex-col bg-white md:inset-x-auto md:right-0 md:max-w-[480px] ${
          settled
            ? ''
            : `transition-transform duration-[200ms] ease-out ${entered ? 'translate-x-0' : 'translate-x-full'}`
        }`}
        style={{
          boxShadow: '-8px 0 24px rgba(0,0,0,0.08)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="parcelle-title"
        onClick={(e) => e.stopPropagation()}
      >
        {fiche ? (
          <ParcellePanel fiche={fiche} onClose={onClose} onNotesChanged={onNotesChanged} />
        ) : (
          <div className="flex flex-1 flex-col">
            <header className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-black/[0.05] px-5 pb-4 pt-5 sm:px-7">
              <h2 id="parcelle-title" className="font-semibold text-text-strong" style={{ fontSize: 18 }}>
                Parcelle
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-text-subtle transition-colors hover:bg-black/[0.05] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <X size={18} strokeWidth={2} aria-hidden />
              </button>
            </header>
            <div className="flex flex-1 items-center justify-center px-6">
              <p className="text-[14px] text-text-muted">Chargement de la parcelle…</p>
            </div>
          </div>
        )}
      </aside>
    </>
  );

  return createPortal(panel, document.body);
}
