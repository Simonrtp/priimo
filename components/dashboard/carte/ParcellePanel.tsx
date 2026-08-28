'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Mic, NotebookPen, Plus, X } from 'lucide-react';
import NotesTerrainList from '@/components/dashboard/notes/NotesTerrainList';
import { useVoiceCapture } from '@/components/dashboard/voice/VoiceCaptureProvider';
import { useUser } from '@/lib/hooks/useUser';
import { markerBadgeColor } from '@/lib/carte/colors';
import { dpeFillColor, parseDpeLetter } from '@/lib/carte/dpe-public';
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

function DpeLetterBadge({ letter }: { letter: string }) {
  const parsed = parseDpeLetter(letter);
  if (!parsed) {
    return <span className="font-semibold text-text">{letter}</span>;
  }
  const bg = dpeFillColor(parsed);
  return (
    <span
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold leading-none"
      style={{ backgroundColor: bg, color: markerBadgeColor(bg) }}
      aria-label={`Classe ${parsed}`}
    >
      {parsed}
    </span>
  );
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
  const { openCapture, openCompose, captureSessionOpen } = useVoiceCapture();
  const { profile } = useUser();
  const [noteTick, setNoteTick] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
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

  useEffect(() => {
    setAddOpen(false);
  }, [fiche.parcelleId]);

  const title = fiche.adresse ?? fiche.reference;
  const noteContext = {
    adresse: fiche.adresse ?? fiche.reference,
    parcelleId: fiche.parcelleId,
  };

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
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-text-subtle transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.05] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
                <ul className="flex flex-col gap-2.5">
                  {fiche.diagnostics.map((d, i) => (
                    <li
                      key={`${d.date}-${d.etiquette}-${i}`}
                      className="flex items-center gap-2.5 text-[13.5px] text-text"
                    >
                      {d.etiquette ? <DpeLetterBadge letter={d.etiquette} /> : null}
                      <span className="min-w-0">
                        {d.type && d.type.toUpperCase() !== 'DPE' ? (
                          <span className="text-text-muted">{d.type} </span>
                        ) : null}
                        {d.date ? (
                          <span className="tabular-nums text-text-subtle">{formatDay(d.date)}</span>
                        ) : (
                          <span className="text-text-subtle">Date inconnue</span>
                        )}
                      </span>
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
                      {copro.procedureEnCours ? <p>Procédure en cours</p> : null}
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
          <div className="mt-4">
            {!addOpen ? (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="inline-flex min-h-[44px] w-full items-center gap-2.5 rounded-xl border border-black/[0.08] bg-white px-3.5 py-2.5 text-left text-[14px] font-medium text-text-strong transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-white"
                  aria-hidden
                >
                  <Plus size={18} strokeWidth={2.4} />
                </span>
                Ajouter une note à cette adresse
              </button>
            ) : (
              <div className="flex flex-col gap-2 rounded-xl border border-black/[0.08] bg-surface p-2">
                <button
                  type="button"
                  onClick={() => {
                    setAddOpen(false);
                    openCompose(noteContext);
                  }}
                  className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <NotebookPen size={18} className="shrink-0 text-text-muted" aria-hidden />
                  <span>
                    <span className="block text-[14px] font-medium text-text-strong">Écrire</span>
                    <span className="block text-[12.5px] text-text-muted">Au clavier</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddOpen(false);
                    openCapture(noteContext);
                  }}
                  className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <Mic size={18} className="shrink-0 text-text-muted" aria-hidden />
                  <span>
                    <span className="block text-[14px] font-medium text-text-strong">Dicter</span>
                    <span className="block text-[12.5px] text-text-muted">À la voix</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="rounded-lg px-3 py-2 text-[13px] font-medium text-text-muted hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Annuler
                </button>
              </div>
            )}
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
        className={`fixed inset-x-0 bottom-0 z-40 hidden transition-opacity duration-fluid-subtle ease-in-out md:block ${
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
            : `transition-transform duration-fluid ease-in-out ${entered ? 'translate-x-0' : 'translate-x-full'}`
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
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-text-subtle transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.05] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
