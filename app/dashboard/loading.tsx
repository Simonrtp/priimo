import { SkeletonProspectList, SkeletonStatsBar } from '@/components/ui/Skeleton';

export default function DashboardLoading() {
  return (
    <>
      <SkeletonStatsBar />
      <div className="mb-4 h-10 animate-pulse rounded-xl bg-gray-200" />
      <div className="mb-4 hidden h-24 animate-pulse rounded-2xl bg-gray-200 md:block" />
      <SkeletonProspectList count={6} />
    </>
  );
}
