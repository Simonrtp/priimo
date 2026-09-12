export default function ActionsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-6">
      <div className="h-4 w-20 animate-pulse rounded bg-black/[0.06]" />
      <div className="h-7 w-40 animate-pulse rounded-lg bg-black/[0.06]" />
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-clay bg-black/[0.05]" />
        ))}
      </div>
    </div>
  );
}
