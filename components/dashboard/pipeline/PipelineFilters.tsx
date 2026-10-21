'use client';

/** Un seul pipeline d’agence : plus de bascule perso / agence. */
export default function PipelineFilters({ kpiLine }: { kpiLine: string }) {
  return (
    <div className="mb-3">
      <p className="text-[13px] text-text-muted">{kpiLine}</p>
    </div>
  );
}
