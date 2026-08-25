export default function EquipeLoading() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[980px] pt-4 md:pt-2 lg:pt-6">
      <div className="mb-6 md:mb-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-black/[0.06]" />
        <div className="mt-3 h-4 w-72 animate-pulse rounded bg-black/[0.05]" />
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[104px] animate-pulse rounded-clay bg-black/[0.05]" />
        ))}
      </div>
    </div>
  );
}
