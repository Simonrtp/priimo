import AccueilSquelette from '@/components/dashboard/accueil/AccueilSquelette';

export function TodayDesktopSkeleton({ masquerEntete = false }: { masquerEntete?: boolean }) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-4 pb-10 pt-4 md:pt-2">
      {masquerEntete ? null : (
        <div className="flex flex-col gap-3">
          <div className="squelette h-8 w-48 rounded-lg" />
          <div className="squelette h-4 w-72 rounded" />
        </div>
      )}
      <AccueilSquelette mobile={false} />
    </div>
  );
}

export function TodayMobileSkeleton({ masquerEntete = false }: { masquerEntete?: boolean }) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-4 pt-4">
      {masquerEntete ? null : (
        <div className="mb-1 flex items-center justify-between">
          <div className="squelette h-4 w-28 rounded" />
          <div className="squelette size-9 rounded-full" />
        </div>
      )}
      <AccueilSquelette mobile />
    </div>
  );
}

export function TodayOverviewSkeleton() {
  return (
    <div className="mt-8 h-40 animate-pulse rounded-clay bg-black/[0.05]" aria-hidden />
  );
}

export function WorkspaceListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="w-full min-w-0">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="h-8 w-40 animate-pulse rounded-lg bg-black/[0.06]" />
          <div className="mt-3 h-4 w-56 animate-pulse rounded bg-black/[0.05]" />
        </div>
        <div className="h-10 w-32 animate-pulse rounded-clay bg-black/[0.05]" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex h-[72px] items-center gap-3 rounded-clay bg-black/[0.04] px-4">
            <div className="size-9 animate-pulse rounded-full bg-black/[0.08]" />
            <div className="min-w-0 flex-1">
              <div className="h-3.5 w-1/2 animate-pulse rounded bg-black/[0.08]" />
              <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-black/[0.05]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
