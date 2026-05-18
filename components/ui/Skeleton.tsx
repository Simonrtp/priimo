export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`h-4 animate-pulse rounded bg-gray-200 ${className}`} />;
}

export function SkeletonProspectCard() {
  return (
    <div className="border-b border-black/[0.05] px-5 py-[18px] max-md:rounded-xl max-md:border max-md:border-black/8 max-md:bg-white max-md:px-3 max-md:py-3 max-md:shadow-soft">
      <div className="flex items-center gap-4">
        <div className="size-11 flex-shrink-0 animate-pulse rounded-full bg-gray-200" />
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonLine className="h-4 w-3/4 max-w-[280px]" />
          <SkeletonLine className="h-3 w-1/2 max-w-[200px]" />
          <SkeletonLine className="h-3 w-1/3 max-w-[120px] md:hidden" />
        </div>
        <div className="hidden h-8 w-24 animate-pulse rounded-full bg-gray-200 lg:block" />
      </div>
    </div>
  );
}

export function SkeletonProspectList({ count = 6 }: { count?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-black/8 bg-white shadow-soft">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonProspectCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonStatsBar() {
  return (
    <div className="mb-4 flex gap-3 overflow-x-auto pb-1">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="w-[200px] max-md:flex-shrink-0 md:flex-1 rounded-2xl border border-black/8 bg-white p-5 shadow-soft"
        >
          <SkeletonLine className="mb-4 h-2 w-16" />
          <SkeletonLine className="h-10 w-14" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTeamMember() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-black/[0.06] bg-white px-4 py-3">
      <div className="size-10 flex-shrink-0 animate-pulse rounded-full bg-gray-200" />
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonLine className="h-4 w-36" />
        <SkeletonLine className="h-3 w-48 max-w-full" />
      </div>
      <SkeletonLine className="hidden h-6 w-20 rounded-full sm:block" />
      <div className="size-9 animate-pulse rounded-lg bg-gray-200" />
    </div>
  );
}

export function SkeletonTeamList({ count = 3 }: { count?: number }) {
  return (
    <ul className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <SkeletonTeamMember />
        </li>
      ))}
    </ul>
  );
}

export function SkeletonFormFields({ fields = 3 }: { fields?: number }) {
  return (
    <div className="flex max-w-xl flex-col gap-5">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i}>
          <SkeletonLine className="mb-2 h-3 w-24" />
          <div className="h-[42px] animate-pulse rounded-lg bg-gray-200" />
        </div>
      ))}
      <SkeletonLine className="mt-2 h-10 w-32 rounded-lg" />
    </div>
  );
}
