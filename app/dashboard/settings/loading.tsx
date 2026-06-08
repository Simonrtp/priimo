import { SkeletonFormFields } from '@/components/ui/Skeleton';

export default function SettingsLoading() {
  return (
    <div className="w-full min-w-0 max-w-5xl">
      <div className="mb-4 space-y-2 md:mb-6">
        <div className="hidden h-7 w-40 animate-pulse rounded bg-gray-200 max-md:hidden md:block" />
        <div className="h-4 w-full max-w-sm animate-pulse rounded bg-gray-200" />
      </div>
      <div className="rounded-2xl border border-black/8 bg-white p-4 shadow-soft sm:p-6 md:p-8">
        <SkeletonFormFields fields={4} />
      </div>
    </div>
  );
}
