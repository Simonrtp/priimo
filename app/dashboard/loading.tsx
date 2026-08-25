import { getDevice } from '@/lib/device-server';

export default async function TodayLoading() {
  const device = await getDevice();
  if (device === 'mobile') {
    return (
      <div className="px-0 pt-4">
        <div className="mb-3 flex items-center justify-between px-4">
          <div className="h-4 w-28 animate-pulse rounded bg-black/[0.06]" />
          <div className="size-9 animate-pulse rounded-full bg-black/[0.06]" />
        </div>
        <div className="divide-y divide-black/[0.06] border-y border-black/[0.06]">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="flex h-[72px] items-center gap-3 px-4">
              <div className="size-2.5 rounded-full bg-black/[0.08]" />
              <div className="min-w-0 flex-1">
                <div className="h-3.5 w-2/3 animate-pulse rounded bg-black/[0.08]" />
                <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-black/[0.05]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 pt-4 md:pt-2">
      <div className="mb-6 md:mb-8">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-black/[0.06]" />
        <div className="mt-3 h-4 w-72 animate-pulse rounded bg-black/[0.05]" />
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[120px] animate-pulse rounded-clay bg-black/[0.05]" />
        ))}
      </div>
      <div className="flex flex-col gap-3 md:gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[168px] animate-pulse rounded-clay bg-black/[0.05]" />
        ))}
      </div>
    </div>
  );
}
