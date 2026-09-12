export default function EstimationLoading() {
  return (
    <div className="flex w-full min-w-0 flex-col gap-4 pt-2">
      <div className="flex gap-2">
        <div className="h-9 w-28 animate-pulse rounded-full bg-black/[0.06]" />
        <div className="h-9 w-24 animate-pulse rounded-full bg-black/[0.04]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-clay bg-black/[0.05]" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-clay bg-black/[0.04]" />
    </div>
  );
}
