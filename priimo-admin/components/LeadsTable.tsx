'use client';

import { useMemo, useState } from 'react';
import { ArrowDownUp, MapPin, X } from 'lucide-react';
import { Badge, ScoreBadge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import type { LeadWithAgency } from '@/lib/queries/admin';
import {
  LEAD_STATUS_LABELS,
  ML_FEEDBACK_LABELS,
  OWNER_TYPE_LABELS,
  extractMainSignal,
  formatDate,
} from '@/lib/utils/format';

type Props = {
  leads: LeadWithAgency[];
  agencies: { id: string; name: string }[];
  initialFilters: {
    agencyId?: string;
    status?: string;
    ownerType?: string;
    minScore?: string;
  };
};

function statusBadgeVariant(status: string) {
  if (status === 'mandat_signe') return 'success' as const;
  if (status === 'interesse') return 'info' as const;
  if (status === 'pas_interesse' || status === 'vendeur_ailleurs') return 'danger' as const;
  return 'default' as const;
}

export function LeadsTable({ leads, agencies, initialFilters }: Props) {
  const [agencyId, setAgencyId] = useState(initialFilters.agencyId ?? '');
  const [status, setStatus] = useState(initialFilters.status ?? '');
  const [ownerType, setOwnerType] = useState(initialFilters.ownerType ?? '');
  const [minScore, setMinScore] = useState(initialFilters.minScore ?? '');
  const [selected, setSelected] = useState<LeadWithAgency | null>(null);
  const [sortDesc, setSortDesc] = useState(true);

  const filtered = useMemo(() => {
    let rows = [...leads];
    if (agencyId) rows = rows.filter((l) => l.agency_id === agencyId);
    if (status) rows = rows.filter((l) => l.status === status);
    if (ownerType) rows = rows.filter((l) => l.owner_type === ownerType);
    const min = minScore ? Number(minScore) : NaN;
    if (!Number.isNaN(min)) rows = rows.filter((l) => l.score >= min);
    rows.sort((a, b) => (sortDesc ? b.score - a.score : a.score - b.score));
    return rows;
  }, [leads, agencyId, status, ownerType, minScore, sortDesc]);

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/[0.06] bg-surface p-4">
        <label className="text-xs">
          <span className="mb-1.5 block font-medium uppercase tracking-widest text-white/40">Agence</span>
          <select value={agencyId} onChange={(e) => setAgencyId(e.target.value)} className="input-dark">
            <option value="">Toutes</option>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1.5 block font-medium uppercase tracking-widest text-white/40">Statut</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-dark">
            <option value="">Tous</option>
            {Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1.5 block font-medium uppercase tracking-widest text-white/40">Type</span>
          <select value={ownerType} onChange={(e) => setOwnerType(e.target.value)} className="input-dark">
            <option value="">Tous</option>
            {Object.entries(OWNER_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1.5 block font-medium uppercase tracking-widest text-white/40">
            Score min. {minScore ? `· ${minScore}` : ''}
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={minScore || '0'}
            onChange={(e) => setMinScore(e.target.value === '0' ? '' : e.target.value)}
            className="h-9 w-40 cursor-pointer accent-indigo-500"
          />
        </label>
        <button
          type="button"
          onClick={() => setSortDesc((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/70 transition hover:border-indigo-500/40 hover:text-indigo-300"
        >
          <ArrowDownUp className="h-3.5 w-3.5" /> Score {sortDesc ? '↓' : '↑'}
        </button>
        <span className="ml-auto self-center text-xs text-white/40">{filtered.length} lead(s)</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-surface">
        {filtered.length === 0 ? (
          <EmptyState icon={MapPin} title="Aucun lead" description="Aucun lead ne correspond aux filtres." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Agence</th>
                <th>Adresse</th>
                <th className="text-right">Score</th>
                <th>Type</th>
                <th>Statut</th>
                <th>Signal</th>
                <th>Feedback ML</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr key={lead.id} className="cursor-pointer" onClick={() => setSelected(lead)}>
                  <td className="max-w-[140px] truncate text-white/70">{lead.agency_name}</td>
                  <td className="max-w-[220px] truncate text-white/80">
                    {lead.address}
                    {lead.postal_code ? ` (${lead.postal_code})` : ''}
                  </td>
                  <td className="text-right">
                    <ScoreBadge score={lead.score} />
                  </td>
                  <td className="text-white/60">{OWNER_TYPE_LABELS[lead.owner_type]}</td>
                  <td>
                    <Badge variant={statusBadgeVariant(lead.status)}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
                  </td>
                  <td className="max-w-[180px] truncate text-white/50">{extractMainSignal(lead.signals)}</td>
                  <td>
                    {lead.ml_feedback ? (
                      <Badge variant="info">{ML_FEEDBACK_LABELS[lead.ml_feedback]}</Badge>
                    ) : (
                      <span className="text-white/25">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Panneau de détail */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <aside
            className="h-full w-full max-w-xl animate-fade-in overflow-auto border-l border-white/[0.08] bg-[#0e0e16] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-white/[0.06] bg-[#0e0e16]/95 px-5 py-4 backdrop-blur">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-white">{selected.address}</h2>
                <p className="text-xs text-white/40">{selected.agency_name}</p>
              </div>
              <div className="flex items-center gap-3">
                <ScoreBadge score={selected.score} />
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-lg p-1.5 text-white/50 hover:bg-white/[0.06] hover:text-white"
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="space-y-5 p-5">
              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/35">
                  Données
                </h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  {Object.entries(selected).map(([key, value]) => {
                    if (key === 'signals' || key === 'display_signals' || key === 'internal_signals') {
                      return null;
                    }
                    const display =
                      value == null
                        ? '—'
                        : typeof value === 'object'
                          ? JSON.stringify(value)
                          : String(value);
                    return (
                      <div key={key} className="contents">
                        <dt className="text-white/40">{key}</dt>
                        <dd className="break-all font-mono text-[11px] text-white/75">{display}</dd>
                      </div>
                    );
                  })}
                </dl>
              </section>
              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/35">
                  Signaux (JSON)
                </h3>
                <pre className="overflow-auto rounded-lg border border-white/[0.06] bg-black/30 p-3 text-[10px] leading-relaxed text-white/70">
                  {JSON.stringify(selected.signals, null, 2)}
                </pre>
              </section>
              {selected.display_signals != null && (
                <section>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/35">
                    display_signals
                  </h3>
                  <pre className="overflow-auto rounded-lg border border-white/[0.06] bg-black/30 p-3 text-[10px] leading-relaxed text-white/70">
                    {JSON.stringify(selected.display_signals, null, 2)}
                  </pre>
                </section>
              )}
              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/35">
                  Feedback ML
                </h3>
                <dl className="grid grid-cols-2 gap-1.5 text-xs">
                  <dt className="text-white/40">ml_feedback</dt>
                  <dd className="text-white/75">
                    {selected.ml_feedback ? ML_FEEDBACK_LABELS[selected.ml_feedback] : '—'}
                  </dd>
                  <dt className="text-white/40">ml_feedback_reason</dt>
                  <dd className="text-white/75">{selected.ml_feedback_reason ?? '—'}</dd>
                  <dt className="text-white/40">ml_feedback_at</dt>
                  <dd className="text-white/75">{formatDate(selected.ml_feedback_at)}</dd>
                </dl>
              </section>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
