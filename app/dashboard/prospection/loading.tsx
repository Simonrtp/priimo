import { SkeletonProspectList } from '@/components/ui/Skeleton';

export default function ProspectionLoading() {
  return (
    <div className="w-full min-w-0">
      <div className="mb-4 h-10 w-64 animate-pulse rounded-clay bg-black/[0.06]" />
      <div className="mb-4 hidden h-24 animate-pulse rounded-clay bg-black/[0.05] md:block" />
      <SkeletonProspectList count={6} />
    </div>
  );
}
