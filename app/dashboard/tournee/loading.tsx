export default function TourneeLoading() {
  return (
    <div className="flex h-full min-h-[60dvh] flex-col gap-3 p-4">
      <div className="h-10 w-48 animate-pulse rounded-lg bg-black/[0.06]" />
      <div className="min-h-0 flex-1 animate-pulse rounded-clay bg-black/[0.05]" />
    </div>
  );
}
