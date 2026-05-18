import { SkeletonFormFields } from '@/components/ui/Skeleton';

export default function SettingsLoading() {
  return (
    <div className="max-w-5xl">
      <div className="mb-6 space-y-2">
        <div className="h-7 w-40 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded bg-gray-200" />
      </div>
      <div className="rounded-2xl border border-black/8 bg-white p-6 shadow-soft sm:p-8">
        <SkeletonFormFields fields={4} />
      </div>
    </div>
  );
}
