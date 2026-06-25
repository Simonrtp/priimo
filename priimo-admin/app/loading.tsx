export default function Loading() {
  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-lg bg-white/[0.05]" />
        <div className="h-4 w-72 animate-pulse rounded bg-white/[0.04]" />
      </div>

      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5">
            <div className="flex items-start justify-between">
              <div className="h-3 w-24 animate-pulse rounded bg-white/[0.06]" />
              <div className="h-9 w-9 animate-pulse rounded-full bg-white/[0.05]" />
            </div>
            <div className="mt-4 h-9 w-20 animate-pulse rounded-lg bg-white/[0.06]" />
          </div>
        ))}
      </div>

      {/* Contenu */}
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-72 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
        ))}
      </div>

      <div className="h-56 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
    </div>
  );
}
