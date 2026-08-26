'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { formatNoteWhen } from '@/lib/notes/format-when';

export type MemberBrief = {
  memberId: string;
  fullName: string;
  lastActivityAt: string | null;
  leads: { id: string; address: string; score: number }[];
  mandats: { id: string; address: string; mandatStatut: string }[];
  notes: { id: string; excerpt: string; createdAt: string }[];
};

export default function DirectorMemberPanel({
  memberId,
  onClose,
}: {
  memberId: string;
  onClose: () => void;
}) {
  const [brief, setBrief] = useState<MemberBrief | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBrief(null);
    setError(null);
    void (async () => {
      try {
        const res = await fetch(`/api/dashboard/today/member/${memberId}`);
        const data = (await res.json()) as { brief?: MemberBrief; error?: string };
        if (cancelled) return;
        if (!res.ok || !data.brief) {
          setError(data.error ?? 'Lecture impossible');
          return;
        }
        setBrief(data.brief);
      } catch {
        if (!cancelled) setError('Lecture impossible');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="member-panel-title">
      <button type="button" className="absolute inset-0 bg-[#1E3148]/25" aria-label="Fermer" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-black/[0.08] bg-surface p-5 shadow-clay-lg">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="member-panel-title" className="text-balance text-[18px] font-semibold text-text-strong">
              {brief?.fullName ?? '…'}
            </h2>
            <p className="mt-1 text-[12.5px] text-text-muted">
              {brief?.lastActivityAt
                ? `Dernière activité · ${formatNoteWhen(brief.lastActivityAt)}`
                : 'Aucune activité récente'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex size-9 items-center justify-center rounded-full text-text-subtle hover:bg-black/[0.04] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>

        {error ? <p className="text-[13.5px] text-text-muted">{error}</p> : null}
        {!brief && !error ? <p className="text-[13.5px] text-text-subtle">Chargement…</p> : null}

        {brief ? (
          <div className="flex flex-col gap-6">
            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
                Leads
              </h3>
              {brief.leads.length === 0 ? (
                <p className="text-[13.5px] text-text-muted">Aucun lead assigné</p>
              ) : (
                <ul className="flex flex-col">
                  {brief.leads.map((lead) => (
                    <li key={lead.id}>
                      <Link
                        href={`/dashboard/prospection?lead=${lead.id}&vue=liste`}
                        className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-lg px-1 py-1 text-[13.5px] hover:bg-black/[0.03]"
                      >
                        <span className="min-w-0 truncate">{lead.address}</span>
                        <span className="tabular-nums text-text-muted">{Math.round(lead.score)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
                Mandats
              </h3>
              {brief.mandats.length === 0 ? (
                <p className="text-[13.5px] text-text-muted">Aucun mandat actif</p>
              ) : (
                <ul className="flex flex-col">
                  {brief.mandats.map((bien) => (
                    <li key={bien.id}>
                      <Link
                        href={`/dashboard/biens?fiche=${bien.id}`}
                        className="flex min-h-10 cursor-pointer items-center rounded-lg px-1 py-1 text-[13.5px] hover:bg-black/[0.03]"
                      >
                        {bien.address}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
                Notes récentes
              </h3>
              {brief.notes.length === 0 ? (
                <p className="text-[13.5px] text-text-muted">Aucune note cette semaine</p>
              ) : (
                <ul className="flex flex-col">
                  {brief.notes.map((note) => (
                    <li key={note.id}>
                      <Link
                        href={`/dashboard/notes?id=${note.id}`}
                        className="block min-h-10 cursor-pointer rounded-lg px-1 py-1.5 hover:bg-black/[0.03]"
                      >
                        <p className="line-clamp-2 text-[13.5px] text-text">{note.excerpt}</p>
                        <p className="mt-0.5 text-[12px] text-text-muted">
                          {formatNoteWhen(note.createdAt)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
