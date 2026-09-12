export default function OriginesLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl py-8 md:px-6">
      <div className="mb-6 space-y-2">
        <div className="h-7 w-56 animate-pulse rounded-lg bg-black/[0.06]" />
        <div className="h-4 w-80 animate-pulse rounded bg-black/[0.05]" />
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-clay bg-black/[0.05]" />
        ))}
      </div>
    </div>
  );
}
