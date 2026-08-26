'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TerrainNote } from '@/types/contact';
import { formatNoteWhen } from '@/lib/notes/format-when';
import { FIELD } from '@/lib/today/field';
import PageHeader from '@/components/dashboard/workspace/PageHeader';
import WorkspaceCard from '@/components/dashboard/workspace/WorkspaceCard';
import Select from '@/components/ui/Select';
import NoteFiche from './NoteFiche';

type InboxNote = TerrainNote;

const STATUT_OPTS = [
  { value: 'tous', label: 'Toutes' },
  { value: 'brute', label: 'Brutes' },
  { value: 'revue', label: 'Revues' },
];
const SCOPE_OPTS = [
  { value: 'moi', label: 'Mes notes' },
  { value: 'agence', label: 'Agence' },
];
const PERIOD_OPTS = [
  { value: 'tous', label: 'Toutes dates' },
  { value: '7j', label: '7 jours' },
  { value: '30j', label: '30 jours' },
];
const LINK_OPTS = [
  { value: 'tous', label: 'Toutes' },
  { value: 'rattachees', label: 'Rattachées' },
  { value: 'orphelines', label: 'Orphelines' },
];

export default function NotesInboxClient({
  initialNoteId = null,
  initialStatut = 'tous',
  initialScope = 'moi',
  initialMembre = null,
}: {
  initialNoteId?: string | null;
  initialStatut?: string;
  initialScope?: string;
  initialMembre?: string | null;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState<InboxNote[] | null>(null);
  const [statut, setStatut] = useState(initialStatut === 'brute' || initialStatut === 'revue' ? initialStatut : 'tous');
  const [scope, setScope] = useState(
    initialMembre ? 'agence' : initialScope === 'agence' ? 'agence' : 'moi',
  );
  const [period, setPeriod] = useState('tous');
  const [rattachement, setRattachement] = useState('tous');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(initialNoteId);
  const membre = initialMembre?.trim() || null;

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      statut,
      scope,
      period,
      rattachement,
      q,
    });
    if (membre) params.set('membre', membre);
    try {
      const res = await fetch(`/api/dashboard/notes/inbox?${params.toString()}`);
      const data = (await res.json()) as { notes?: InboxNote[] };
      setNotes(data.notes ?? []);
    } catch {
      setNotes([]);
    }
  }, [statut, scope, period, rattachement, q, membre]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, q ? 220 : 0);
    return () => window.clearTimeout(t);
  }, [load, q]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[980px] pt-4 md:pt-2 lg:pt-6">
      <PageHeader title="Notes" subtitle="Retrouver, relire et classer ce qui a été dicté." />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher dans le transcript"
          aria-label="Rechercher dans le transcript"
          className="min-h-10 flex-1 rounded-xl border border-black/8 bg-white px-3 text-[13.5px] text-text"
        />
        <Select aria-label="Statut" value={statut} onChange={setStatut} options={STATUT_OPTS} />
        <Select aria-label="Portée" value={scope} onChange={setScope} options={SCOPE_OPTS} />
        <Select aria-label="Période" value={period} onChange={setPeriod} options={PERIOD_OPTS} />
        <Select aria-label="Rattachement" value={rattachement} onChange={setRattachement} options={LINK_OPTS} />
      </div>

      {notes === null ? (
        <p className="py-8 text-[14px] text-text-muted">Chargement…</p>
      ) : notes.length === 0 ? (
        <WorkspaceCard className="py-12 text-center">
          <p className="text-pretty text-[14px] text-text-muted">Aucune note ne correspond à ces filtres.</p>
        </WorkspaceCard>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <li key={note.id}>
              <button
                type="button"
                onClick={() => setOpenId(note.id)}
                className="flex w-full flex-col rounded-clay border border-black/[0.06] bg-surface px-4 py-3 text-left shadow-clay-sm hover:bg-black/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <p className="line-clamp-2 text-pretty text-[14px] text-text">
                  {(note.transcript ?? '').trim() || 'Sans transcription'}
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px] text-text-muted">
                  <time dateTime={note.createdAt}>{formatNoteWhen(note.createdAt)}</time>
                  {note.authorName ? <span>· {note.authorName}</span> : null}
                  {note.statut === 'brute' ? (
                    <span className="inline-flex items-center gap-1">
                      <span
                        className="inline-block size-1.5 rounded-full"
                        style={{ background: '#3D5A80' }}
                        aria-hidden
                      />
                      Brute
                    </span>
                  ) : (
                    <span>Revue</span>
                  )}
                  {!note.hasFicheLink ? <span>· Orpheline</span> : null}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {openId ? (
        <NoteFiche
          noteId={openId}
          onClose={() => {
            setOpenId(null);
            router.replace('/dashboard/notes', { scroll: false });
          }}
          onChanged={() => void load()}
        />
      ) : null}
    </div>
  );
}
